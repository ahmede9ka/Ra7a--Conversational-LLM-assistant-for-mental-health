import Link from "next/link";

const areas = [
  { href: "/", label: "Talk" },
  { href: "/reflect", label: "Reflect" },
  { href: "/reset", label: "Reset" },
  { href: "/progress", label: "My Progress" },
];

export function WellbeingNav({ active }: { active: string }) {
  return <nav className="wellbeing-nav" aria-label="Ra7a areas">
    {areas.map((area) => <Link key={area.href} href={area.href} aria-current={active === area.href ? "page" : undefined}>{area.label}</Link>)}
  </nav>;
}
