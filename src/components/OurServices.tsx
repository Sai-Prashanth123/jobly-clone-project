import { Link } from 'react-router-dom';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const services = [
  { img: '/assets/img/home/our2.png', title: 'Career Guidance', desc: "For all your career planning, please contact us. You won't be disappointed with the advice", href: '/career-guidance' },
  { img: '/assets/img/home/our-portfolio-home__item-2.png', title: 'Staffing And Consulting', desc: 'Staffing and consulting services have a major role in the functioning of an organization', href: '/staffing-and-consulting' },
  { img: '/assets/img/home/our-portfolio-home__item-3.png', title: 'Software Training', desc: 'Jobly empowers you to take your talent far and wide, build a dedicated community', href: '/software-training' },
];

const OurServices = () => {
  const ref1 = useScrollReveal('animate__fadeInUp', 0.15, '0s');
  const ref2 = useScrollReveal('animate__fadeInUp', 0.15, '0.15s');
  const ref3 = useScrollReveal('animate__fadeInUp', 0.15, '0.3s');
  const refs = [ref1, ref2, ref3];
  return (
  <section className="our-portfolio-home pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-120 pb-120 overflow-hidden">
    <div className="container">
      <div className="row align-items-center">
        <div className="col-12">
          <div className="our-portfolio-home__content text-center mb-60 mb-sm-50 mb-xs-40">
            <span className="sub-title fw-500 text-uppercase mb-sm-10 mb-xs-5 mb-15 d-block color-red">
              <img src="/assets/img/home/line.svg" className="img-fluid mr-10" alt="" /> Jobly
            </span><br />
            <h2 className="title color-pd_black">Our Services</h2>
          </div>
        </div>
      </div>
      <div className="row mb-minus-30">
        {services.map((s, i) => (
          <div key={s.title} className="col-xl-4 col-md-6 col-12" ref={refs[i]}>
            <div className="our-portfolio-home__item mb-30">
              <div className="featured-thumb">
                <div className="media overflow-hidden">
                  <img src={s.img} className="img-fluid" alt={s.title} />
                </div>
              </div>
              <div className="content d-flex flex-row">
                <div className="left">
                  <h5 className="color-pd_black mb-15 mb-xs-10">
                    <Link to={s.href}>{s.title}</Link>
                  </h5>
                  <div className="description font-la"><p>{s.desc}</p></div>
                </div>
                <div className="btn-link-share">
                  <Link to={s.href} className="theme-btn color-pd_black" style={{ backgroundImage: 'url(/assets/img/home/theme-btn-overly.png)' }}>
                    Read More <i className="fas fa-long-arrow-alt-right"></i>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
  );
};

export default OurServices;
