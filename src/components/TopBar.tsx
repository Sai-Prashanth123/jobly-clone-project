const TopBar = () => (
  <div className="top-header d-none d-xl-block">
    <div className="container">
      <div className="row align-items-center">
        <div className="col-4">
          <div className="header-right-socail d-flex align-items-center">
            <h6 className="font-la color-white fw-normal">Follow On:</h6>
            <div className="social-profile">
              <ul>
                <li><a href="https://www.facebook.com/people/Jobly-Solutions/100089951006079/?mibextid=ZbWKwL" target="_blank"><i className="fab fa-facebook-f"></i></a></li>
                <li><a href="https://twitter.com/JoblySolutions?t=9w8dme-dvzco-hwWP4eoVg&s=08" target="_blank"><i className="fab fa-twitter"></i></a></li>
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

export default TopBar;
