import { Link } from 'react-router-dom';

const cards = [
  { img: '/assets/img/home/mission.png', title: 'Mission', desc: 'Giving quality and beneficial programming answers for our predominant customers' },
  { img: '/assets/img/home/vission.png', title: 'Vision', desc: 'Creating new milestones in knowledge and skill enhancement. Empowering higher education' },
  { img: '/assets/img/home/culture.png', title: 'Culture', desc: 'A certainty that our faculty discover "work" intriguing, duty to unwavering quality' },
];

const OurCompany = () => (
  <section className="why-choose why-choose__home pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-120 pb-120 overflow-hidden">
    <div className="container">
      <div className="row">
        <div className="col-lg-6">
          <div className="why-choose__content why-choose__content-home">
            <div className="why-choose__text">
              <span className="sub-title d-block fw-500 color-red text-uppercase mb-sm-10 mb-xs-5 mb-15">
                <img src="/assets/img/home/line.svg" className="img-fluid mr-10" alt="" /> Jobly
              </span>
              <h2 className="title color-pd_black">Our Company</h2>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="why-choose__content why-choose__content-home mt-md-25 mt-sm-20 mt-xs-20">
            <div className="description font-la">
              <p>We genuinely have certainty that business elements develop and advance not just through the movement in their particular organizations additionally by designing a situation which consoles self-examination and enablement.</p>
            </div>
            <Link to="/about" className="theme-btn btn-sm btn-red mt-30 mt-sm-25 mt-xs-20">
              Read More<i className="far fa-chevron-double-right"></i>
            </Link>
          </div>
        </div>
      </div>

      <div className="row">
        {cards.map(c => (
          <div key={c.title} className="col-xl-4 col-md-6 col-12 mb-30">
            <div className="why-choose__item why-choose__item-two" style={{ backgroundImage: 'url(/assets/img/home/why-choose__item-two-overly.png)' }}>
              <div className="icon mb-30 mb-lg-20 mb-md-10 mb-xs-5 color-red">
                <img src={c.img} alt={c.title} />
              </div>
              <h6 className="title color-pd_black fw-600 mb-15 mb-xs-10">{c.title}</h6>
              <div className="description font-la mb-20 mb-sm-15 mb-xs-10">
                <p>{c.desc}</p>
              </div>
              <Link to="/about" className="color-red d-block">Read More <i className="far fa-chevron-double-right"></i></Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default OurCompany;
