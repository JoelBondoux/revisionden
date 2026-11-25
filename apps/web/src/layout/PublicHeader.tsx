import { Link } from 'react-router-dom';
import { Pip } from '../components/Pip';

/** The signed-out header for public pages: logo, Sign in, Policies and About. */
export function PublicHeader() {
  return (
    <header className="public-header">
      <Link to="/" className="public-header__brand" aria-label="RevisionDen home">
        <Pip size={32} />
        <span aria-hidden="true">RevisionDen</span>
      </Link>
      <nav aria-label="Site" className="public-header__nav">
        <Link to="/">Sign in</Link>
        <Link to="/legal">Policies</Link>
        <Link to="/about">About</Link>
      </nav>
    </header>
  );
}
