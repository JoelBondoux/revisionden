import { Link } from 'react-router-dom';
import { LinkChip } from '../components/links';
import { Pip } from '../components/Pip';

/** The signed-out header for public pages: logo, Sign in, Policies, About and Get help. */
export function PublicHeader() {
  return (
    <header className="public-header">
      <Link to="/" className="public-header__brand" aria-label="RevisionDen home">
        <Pip size={32} />
        <span aria-hidden="true">RevisionDen</span>
      </Link>
      <nav aria-label="Site" className="public-header__nav">
        <LinkChip to="/">Sign in</LinkChip>
        <LinkChip to="/legal">Policies</LinkChip>
        <LinkChip to="/about">About</LinkChip>
        <LinkChip to="/help">Get help</LinkChip>
      </nav>
    </header>
  );
}
