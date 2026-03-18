import { Link } from 'react-router-dom';

interface ServiceSidebarProps {
  active: string;
  haveAnyImg: string;
}

const ServiceSidebar = ({ active, haveAnyImg }: ServiceSidebarProps) => {
  return (
    <div className="main-sidebar">
      <div className="single-sidebar-widget mb-40 pt-30 pr-30 pb-40 pl-30 pl-xs-20 pr-xs-20">
        <h4 className="wid-title mb-30 mb-xs-20 color-d_black text-capitalize">Services</h4>
        <div className="widget_categories">
          <ul>
            <li className={active === '/career-guidance' ? 'active' : ''}>
              <Link to="/career-guidance">Career Guidance<i className="fas fa-long-arrow-alt-right"></i></Link>
            </li>
            <li className={active === '/staffing-and-consulting' ? 'active' : ''}>
              <Link to="/staffing-and-consulting">Staffing And Consulting <i className="fas fa-long-arrow-alt-right"></i></Link>
            </li>
            <li className={active === '/software-training' ? 'active' : ''}>
              <Link to="/software-training">Software Training <i className="fas fa-long-arrow-alt-right"></i></Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="single-sidebar-widget have-any mb-40 pt-30 pr-30 pb-40 pl-30 pl-xs-20 pr-xs-20">
        <div className="media">
          <img src={haveAnyImg} alt="" />
        </div>
        <div className="have-any__item text-center" style={{ backgroundImage: 'url(/assets/img/services-details/have-any-bottom.png)' }}>
          <h4 className="wid-title mb-20 mb-xs-15 color-white text-capitalize">Get In Touch</h4>
          <Link to="/contact" className="theme-btn">Contact Us <i className="fab fa-telegram-plane"></i></Link>
        </div>
      </div>
    </div>
  );
};

export default ServiceSidebar;
