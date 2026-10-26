import Link from "next/link";

export default function Nav() {
  return (
    <nav className="nav noprint" aria-label="Main">
      <Link href="/">Syllabus audit</Link>
      <Link href="/opportunities">Find funding</Link>
    </nav>
  );
}
