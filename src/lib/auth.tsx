import {
  ClerkProvider,
  SignIn as ClerkSignIn,
  SignUp as ClerkSignUp,
  UserButton as ClerkUserButton,
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from "@clerk/tanstack-react-start";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import type Keycloak from "keycloak-js";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  authProviderMode,
  oidcBrowserConfig,
  oidcUser,
  safeAuthReturnPath,
} from "./authPolicy";

const mode = authProviderMode(import.meta.env.VITE_AUTH_PROVIDER);
type User = ReturnType<typeof oidcUser>;
type AuthState = {
  isLoaded: boolean;
  user: User;
  error: string | null;
  fetchAccessToken: (options: {
    forceRefreshToken: boolean;
  }) => Promise<string | null>;
  login: (returnPath?: string) => Promise<void>;
  switchAccount: (returnPath: string) => Promise<void>;
  logout: () => Promise<void>;
  account: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);
let keycloak: Keycloak | undefined;
let keycloakInitialization: Promise<boolean> | undefined;
let keycloakReady = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

async function initializeKeycloak() {
  if (!keycloakInitialization) {
    keycloakInitialization = (async () => {
      const { default: KeycloakClient } = await import("keycloak-js");
      keycloak = new KeycloakClient(
        oidcBrowserConfig(import.meta.env, import.meta.env.DEV),
      );
      keycloak.onAuthSuccess = notify;
      keycloak.onAuthRefreshSuccess = notify;
      keycloak.onAuthLogout = notify;
      keycloak.onAuthRefreshError = () => {
        keycloak?.clearToken();
        notify();
      };
      keycloak.onTokenExpired = () => {
        void keycloak?.updateToken(30).catch(() => {
          keycloak?.clearToken();
          notify();
        });
      };
      const authenticated = await keycloak.init({
        onLoad: "check-sso",
        pkceMethod: "S256",
        flow: "standard",
        checkLoginIframe: false,
        silentCheckSsoFallback: false,
        scope: "openid profile email",
      });
      keycloakReady = true;
      notify();
      return authenticated;
    })().catch((error) => {
      // A temporary discovery/network failure must not poison every later retry.
      keycloakInitialization = undefined;
      keycloak = undefined;
      keycloakReady = false;
      throw error;
    });
  }
  await keycloakInitialization;
  return keycloak!;
}

// OAuth callback state/code must be consumed before the router normalizes the URL.
export async function initializeBrowserAuth() {
  if (mode === "keycloak") await initializeKeycloak();
}

function KeycloakStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    isLoaded: boolean;
    user: User;
    error: string | null;
  }>({ isLoaded: false, user: null, error: null });
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active && keycloakReady)
        setState({
          isLoaded: true,
          user: keycloak?.authenticated ? oidcUser(keycloak.tokenParsed) : null,
          error: null,
        });
    };
    listeners.add(update);
    void initializeKeycloak()
      .then(update)
      .catch(() => {
        if (active)
          setState({
            isLoaded: true,
            user: null,
            error:
              "Sign-in is unavailable. Retry after the authentication service is restored.",
          });
      });
    return () => {
      active = false;
      listeners.delete(update);
    };
  }, []);
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        const client = await initializeKeycloak();
        if (!client.authenticated) return null;
        await client.updateToken(forceRefreshToken ? -1 : 30);
        return client.token ?? null;
      } catch {
        keycloak?.clearToken();
        notify();
        return null;
      }
    },
    [],
  );
  const login = useCallback(async (returnPath = "/dashboard") => {
    const client = await initializeKeycloak();
    await client.login({
      redirectUri: `${window.location.origin}${safeAuthReturnPath(returnPath)}`,
    });
  }, []);
  const logout = useCallback(async () => {
    const client = await initializeKeycloak();
    await client.logout({ redirectUri: `${window.location.origin}/sign-in` });
  }, []);
  const switchAccount = useCallback(async (returnPath: string) => {
    const client = await initializeKeycloak();
    // A normal login can immediately reuse the wrong account's SSO session.
    // Explicit switching must show credentials while retaining the exact invite.
    await client.login({
      prompt: "login",
      redirectUri: `${window.location.origin}${safeAuthReturnPath(returnPath)}`,
    });
  }, []);
  const account = useCallback(async () => {
    (await initializeKeycloak()).accountManagement();
  }, []);
  const value = useMemo(
    () => ({
      ...state,
      fetchAccessToken,
      login,
      switchAccount,
      logout,
      account,
    }),
    [state, fetchAccessToken, login, switchAccount, logout, account],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ClerkStateProvider({ children }: { children: ReactNode }) {
  const auth = useClerkAuth();
  const { user, isLoaded } = useClerkUser();
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        return await auth.getToken({
          template: "convex",
          skipCache: forceRefreshToken,
        });
      } catch {
        return null;
      }
    },
    [auth.getToken, auth.userId, auth.sessionId, auth.orgId, auth.orgRole],
  );
  const value = useMemo<AuthState>(
    () => ({
      isLoaded: auth.isLoaded && isLoaded,
      user: user
        ? {
            id: user.id,
            fullName:
              user.fullName ||
              user.primaryEmailAddress?.emailAddress ||
              "Team member",
            primaryEmailAddress: user.primaryEmailAddress
              ? {
                  emailAddress:
                    user.primaryEmailAddress.emailAddress.toLowerCase(),
                }
              : undefined,
          }
        : null,
      error: null,
      fetchAccessToken,
      login: async (returnPath = "/dashboard") => {
        window.location.assign(
          `/sign-in?redirect_url=${encodeURIComponent(safeAuthReturnPath(returnPath))}`,
        );
      },
      logout: async () => {
        await auth.signOut();
      },
      switchAccount: async (returnPath: string) => {
        await auth.signOut({
          redirectUrl: `/sign-in?redirect_url=${encodeURIComponent(safeAuthReturnPath(returnPath))}`,
        });
      },
      account: async () => {},
    }),
    [auth, user, isLoaded, fetchAccessToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (mode === "keycloak")
    return <KeycloakStateProvider>{children}</KeycloakStateProvider>;
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkStateProvider>{children}</ClerkStateProvider>
    </ClerkProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("Authentication provider is missing.");
  return {
    ...context,
    userId: context.user?.id ?? null,
    isLoading: !context.isLoaded,
    isAuthenticated: Boolean(context.user),
  };
}

export function useUser() {
  const { user, isLoaded } = useAuth();
  return { user, isLoaded };
}

function SelfHostedSignIn({
  fallbackRedirectUrl,
}: {
  fallbackRedirectUrl?: string;
}) {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const attempted = useRef(false);
  const login = useCallback(async () => {
    attempted.current = true;
    setError(null);
    setPending(true);
    try {
      await auth.login(safeAuthReturnPath(fallbackRedirectUrl));
    } catch {
      setError(
        "Unable to open sign-in. Retry after the authentication service is restored.",
      );
      setPending(false);
    }
  }, [auth.login, fallbackRedirectUrl]);
  useEffect(() => {
    if (!auth.isLoaded || auth.error) return;
    if (auth.userId) {
      window.location.replace(safeAuthReturnPath(fallbackRedirectUrl));
      return;
    }
    if (!attempted.current) void login();
  }, [auth.isLoaded, auth.error, auth.userId, fallbackRedirectUrl, login]);
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted">
        {error || auth.error || "Opening secure agency sign-in…"}
      </p>
      <Button onClick={() => void login()} disabled={pending && !error}>
        {pending && !error ? "Opening sign-in…" : "Retry sign-in"}
      </Button>
      <p className="text-xs text-muted">
        Accounts are managed by your agency administrator.
      </p>
    </div>
  );
}

export function SignIn(props: ComponentProps<typeof ClerkSignIn>) {
  return mode === "keycloak" ? (
    <SelfHostedSignIn
      fallbackRedirectUrl={
        typeof props.fallbackRedirectUrl === "string"
          ? props.fallbackRedirectUrl
          : "/dashboard"
      }
    />
  ) : (
    <ClerkSignIn {...props} />
  );
}

export function SignUp(props: ComponentProps<typeof ClerkSignUp>) {
  return mode === "keycloak" ? (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted">
        This is a private agency workspace. Ask your administrator to create
        your account, then sign in.
      </p>
      <a
        href={`/sign-in?redirect_url=${encodeURIComponent(safeAuthReturnPath(typeof props.fallbackRedirectUrl === "string" ? props.fallbackRedirectUrl : "/dashboard"))}`}
      >
        <Button>Sign in</Button>
      </a>
    </div>
  ) : (
    <ClerkSignUp {...props} />
  );
}

export function UserButton(props: ComponentProps<typeof ClerkUserButton>) {
  const auth = useAuth();
  if (mode === "clerk") return <ClerkUserButton {...props} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-xs font-semibold text-foreground"
          aria-label="Account menu"
          title={auth.user?.fullName}
        >
          {(auth.user?.fullName || "Team member")
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void auth.account()}>
          Manage account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void auth.logout()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
