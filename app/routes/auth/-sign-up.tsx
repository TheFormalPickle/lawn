import { authAppearance } from "@/lib/authAppearance";
import { SignUp } from "@/lib/auth";
import { useRouterState } from "@tanstack/react-router";

export default function SignUpPage() {
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const redirectUrl = new URLSearchParams(search).get("redirect_url");

  return (
    <SignUp
      fallbackRedirectUrl={redirectUrl || "/dashboard"}
      appearance={authAppearance}
    />
  );
}
