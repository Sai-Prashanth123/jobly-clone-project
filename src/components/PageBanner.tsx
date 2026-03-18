import { Link } from 'react-router-dom';

interface PageBannerProps {
  bgImage: string;
  transparentText: string;
  title: React.ReactNode;
  breadcrumb: string;
}

const PageBanner = ({ bgImage, transparentText, title, breadcrumb }: PageBannerProps) => (
  <section className="page-banner pt-xs-60 pt-sm-80 overflow-hidden">
    <div className="container">
      <div className="row align-items-center">
        <div className="col-md-6">
          <div className="page-banner__content mb-xs-10 mb-sm-15 mb-md-15 mb-20">
            <div className="transparent-text">{transparentText}</div>
            <div className="page-title">
              <h1>{title}</h1>
            </div>
          </div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item"><Link to="/">Home</Link></li>
              <li className="breadcrumb-item active" aria-current="page">{breadcrumb}</li>
            </ol>
          </nav>
        </div>
        <div className="col-md-6">
          <div className="page-banner__media mt-xs-30 mt-sm-40">
            <img src="/assets/img/page-banner/page-banner-start.svg" className="img-fluid start" alt="" />
            <img src={bgImage} className="img-fluid" alt="" />
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default PageBanner;
