import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="footer-1 footer-3 overflow-hidden" style={{ backgroundImage: 'url(/assets/img/footer/footer-bg-3.png)' }}>
    <div className="overly"><div className="container"></div></div>
    <div className="container">
      <div className="row justify-content-between">
        <div className="col-md-6 col-xl-3">
          <div className="single-footer-wid widget-description">
            <Link to="/" className="d-block mb-30 mb-xs-20">
              <img src="/assets/img/logo/footer-logo-3.png" alt="Jobly Solutions" />
            </Link>
            <div className="description font-la color-white mb-40 mb-sm-30 mb-xs-25">
              <p>We genuinely have certainty that business elements develop and advance not just through the movement in their particular organizations additionally by designing a situation which consoles self-examination and enablement.</p>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-xl-2">
          <div className="single-footer-wid pl-xl-10 pl-50">
            <h4 className="wid-title mb-30 color-white">Quick Links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/careers">Careers</Link></li>
              <li><Link to="/technology">Technology</Link></li>
              <li><Link to="/contact">Support</Link></li>
            </ul>
          </div>
        </div>

        <div className="col-md-6 col-xl-3">
          <div className="single-footer-wid pl-xl-10 pl-50">
            <h4 className="wid-title mb-30 color-white">Services</h4>
            <ul>
              <li><Link to="/career-guidance">Career Guidance</Link></li>
              <li><Link to="/staffing-and-consulting">Staffing And Consulting</Link></li>
              <li><Link to="/software-training">Software Training</Link></li>
            </ul>
          </div>
        </div>

        <div className="col-md-6 col-xl-4">
          <div className="single-footer-wid2 pl-xl-10 pl-50">
            <h4 className="wid-title mb-30 color-white">Contact</h4><br />
            <ul>
              <li><a><i className="fas fa-map-marker-alt"></i> 110 Samaritan Dr Suite#211, Cumming, GA, 30040, USA</a></li>
              <li><a href="tel:+14048635745"><i className="fas fa-phone"></i> +1 404-863-5745</a></li>
              <li><a><i className="fas fa-fax"></i> +1 470 660 5973</a></li>
              <li><a href="mailto:info@joblysolutions.com"><i className="fas fa-envelope"></i> info@joblysolutions.com</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div className="footer-bottom overflow-hidden mt-20 mt-sm-15 mt-xs-10">
      <div className="container">
        <div className="footer-bottom-content d-flex flex-column flex-md-row justify-content-between align-items-center">
          <div className="coppyright text-center text-md-start">
            © 2022 <Link to="/">Jobly</Link> | All Rights Reserved.
          </div>
          <div className="footer-bottom-list last_no_bullet">
            <ul>
              <li><a href="#">Terms &amp; Conditions</a></li>
              <li className="no_bullet"><a href="#">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
