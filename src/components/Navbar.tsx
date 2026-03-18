import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const servicesSub = [
  { label: 'Career Guidance Service', path: '/career-guidance' },
  { label: 'Staffing And Consulting Services', path: '/staffing-and-consulting' },
  { label: 'Software Training', path: '/software-training' },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <header className="header header-1 header-3">
        <TopBarInline />
        <div className="main-header-wraper">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="header-logo">
                    <div className="logo">
                      <Link to="/"><img src="/assets/img/logo/logo-3.png" alt="Jobly Solutions" /></Link>
                    </div>
                  </div>

                  <div className="header-menu d-none d-xl-block">
                    <div className="main-menu">
                      <ul>
                        <li className={location.pathname === '/' ? 'active' : ''}><Link to="/">Home</Link></li>
                        <li className={location.pathname === '/about' ? 'active' : ''}><Link to="/about">About</Link></li>
                        <li className={`dropdown ${servicesSub.some(s => location.pathname === s.path) ? 'active' : ''}`}>
                          <a>Services<i className="fas fa-caret-down"></i></a>
                          <ul>
                            {servicesSub.map(s => (
                              <li key={s.path}><Link to={s.path}>{s.label}</Link></li>
                            ))}
                          </ul>
                        </li>
                        <li className={location.pathname === '/careers' ? 'active' : ''}><Link to="/careers">Careers</Link></li>
                        <li className={location.pathname === '/technology' ? 'active' : ''}><Link to="/technology">Technology</Link></li>
                        <li className={location.pathname === '/clients' ? 'active' : ''}><Link to="/clients">Clients</Link></li>
                        <li className={location.pathname === '/contact' ? 'active' : ''}><Link to="/contact">Contact</Link></li>
                      </ul>
                    </div>
                  </div>

                  <div className="header-right d-flex align-items-center">
                    <div className="mobile-nav-bar d-block ml-3 ml-sm-5 d-xl-none">
                      <div className="mobile-nav-wrap">
                        <div id="hamburger" className="color-primary" onClick={() => setMobileOpen(true)}>
                          <i className="fal fa-bars"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <div className={`mobile-nav mobile-nav-red${mobileOpen ? ' nav-open' : ''}`}>
        <button type="button" className="close-nav" onClick={() => setMobileOpen(false)}>
          <i className="fal fa-times-circle"></i>
        </button>
        <nav className="sidebar-nav">
          <div className="navigation">
            <div className="consulter-mobile-nav">
              <ul className="consulter-navbar-mobile">
                <li><Link to="/" onClick={() => setMobileOpen(false)}>Home</Link></li>
                <li><Link to="/about" onClick={() => setMobileOpen(false)}>About</Link></li>
                <li className="dropdown">
                  <a>Services</a>
                  <ul className="dropdown-menu">
                    {servicesSub.map(s => (
                      <li key={s.path}><Link to={s.path} onClick={() => setMobileOpen(false)}>{s.label}</Link></li>
                    ))}
                  </ul>
                </li>
                <li><Link to="/careers" onClick={() => setMobileOpen(false)}>Careers</Link></li>
                <li><Link to="/technology" onClick={() => setMobileOpen(false)}>Technology</Link></li>
                <li><Link to="/clients" onClick={() => setMobileOpen(false)}>Clients</Link></li>
                <li><Link to="/contact" onClick={() => setMobileOpen(false)}>Contact</Link></li>
              </ul>
            </div>
            <div className="sidebar-nav__bottom mt-20">
              <div className="sidebar-nav__bottom-contact-infos mb-20">
                <h6 className="color-black mb-5">Contact Info</h6>
                <ul>
                  <li><a href="mailto:info@joblysolutions.com"><i className="icon-email"></i> info@joblysolutions.com</a></li>
                  <li><a href="tel:+14048635745"><i className="icon-phone"></i> +1 404-863-5745</a></li>
                </ul>
              </div>
              <div className="sidebar-nav__bottom-social">
                <h6 className="color-black mb-5">Follow On:</h6>
                <ul>
                  <li><a href="https://www.facebook.com/people/Jobly-Solutions/100089951006079/?mibextid=ZbWKwL" target="_blank"><i className="fab fa-facebook-f"></i></a></li>
                  <li><a href="https://twitter.com/JoblySolutions" target="_blank"><i className="fab fa-twitter"></i></a></li>
                  <li><a href="#"><i className="fab fa-instagram"></i></a></li>
                  <li><a href="https://www.linkedin.com/company/jobly-solutions/" target="_blank"><i className="fab fa-linkedin-in"></i></a></li>
                </ul>
              </div>
            </div>
          </div>
        </nav>
      </div>
      {mobileOpen && <div className="offcanvas-overlay" onClick={() => setMobileOpen(false)}></div>}

      <div className="header-gutter home"></div>
    </>
  );
};

// Inline top bar (included inside header tag like original)
const TopBarInline = () => (
  <div className="top-header d-none d-xl-block">
    <div className="container">
      <div className="row align-items-center">
        <div className="col-4">
          <div className="header-right-socail d-flex align-items-center">
            <h6 className="font-la color-white fw-normal">Follow On:</h6>
            <div className="social-profile">
              <ul>
                <li><a href="https://www.facebook.com/people/Jobly-Solutions/100089951006079/?mibextid=ZbWKwL" target="_blank"><i className="fab fa-facebook-f"></i></a></li>
                <li><a href="https://twitter.com/JoblySolutions" target="_blank"><i className="fab fa-twitter"></i></a></li>
                <li><a href="#"><i className="fab fa-instagram"></i></a></li>
                <li><a href="https://www.linkedin.com/company/jobly-solutions/" target="_blank"><i className="fab fa-linkedin-in"></i></a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="col-8">
          <div className="header-cta d-flex justify-content-end">
            <ul>
              <li><a href="tel:+14048635745"><i className="icon-phone"></i> +1 404-863-5745</a></li>
              <li><a href="mailto:info@joblysolutions.com"><i className="icon-email"></i> info@joblysolutions.com</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default Navbar;
