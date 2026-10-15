import { authAppearance } from "@/lib/authAppearance";
import { SignIn } from "@/lib/auth";
import { useRouterState } from "@tanstack/react-router";

export default function SignInPage() {
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const redirectUrl = new URLSearchParams(search).get("redirect_url");

  return (
    <SignIn
      fallbackRedirectUrl={redirectUrl || "/dashboard"}
      appearance={authAppearance}
    />
  );
}
