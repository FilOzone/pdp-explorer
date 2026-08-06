import { Link } from "react-router-dom";
import { NameLogo } from "./NameLogo";

export function Footer() {
  return (
    <footer className="border-t bg-secondary/50">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <NameLogo />

        <nav
          className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm tracking-wide text-muted-foreground"
          aria-label="Footer"
        >
          <Link to="/documentation" className="transition-colors hover:text-foreground">
            Docs
          </Link>
          <a
            href="https://status.filecoin.cloud"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Status
          </a>
          <a
            href="https://github.com/FilOzone/pdp-explorer"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>

        <p className="text-sm text-muted-foreground">
          Built by{" "}
          <a
            href="https://github.com/FilOzone"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary transition-colors hover:text-primary-hover hover:underline"
          >
            FilOz
          </a>
        </p>
      </div>
    </footer>
  );
}
