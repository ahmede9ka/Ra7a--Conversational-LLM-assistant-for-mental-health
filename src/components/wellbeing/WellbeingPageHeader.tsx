import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";

export function WellbeingPageHeader({ account }: { account: string }) {
  return <header className="app-topbar wellbeing-topbar"><Link className="wellbeing-brand" href="/">راحة <span>Ra7a</span></Link><div className="topbar-actions"><span className="signed-in-as">{account}</span><Link className="wellbeing-header-link" href="/settings">Settings</Link><form action={signOutAction}><button className="logout-button" type="submit">Log out</button></form></div></header>;
}
