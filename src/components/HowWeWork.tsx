import { Link } from 'react-router-dom';
import { useInViewReveal } from '@/hooks/useInViewReveal';

// Replaces the old "Our Company" block, which duplicated the About Us section
// immediately above it and carried spun filler copy ("business elements develop
// and advance not just through the movement in their particular organizations
// additionally by..."). A plain statement of how an engagement actually runs is
// more use to a visitor deciding whether to call, and it gives the page the
// process section it was missing.
//
// Three steps, not four: the grid is col-xl-4, so three cards fill the row
// exactly. A fourth would wrap onto its own line and leave two thirds of the
// row empty — the same gap problem being fixed elsewhere on this page.
const steps = [
  {
    img: '/assets/img/home/mission.png',
    step: '01',
    title: 'Understand',
    desc: 'We start with the problem, not the headcount. A short discovery on the roles, skills and timelines you actually need — and an honest view of what the market will support.',
  },
  {
    img: '/assets/img/home/vission.png',
    step: '02',
    title: 'Deliver',
    desc: 'Sourcing, screening and placement handled by people who do it every day. You meet a shortlist worth interviewing, with named consultants who stay on your account.',
  },
  {
    img: '/assets/img/home/culture.png',
    step: '03',
    title: 'Sustain',
    desc: 'We stay after the placement — onboarding, compliance and documentation tracked, with regular check-ins so issues surface while they are still small.',
  },
];

const HowWeWork = () => {
  const sectionRef = useInViewReveal<HTMLElement>();
  return (
  <section ref={sectionRef} className="reveal why-choose why-choose__home pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-80 pb-80 overflow-hidden">
    <div className="container">
      <div className="row">
        <div className="col-lg-6">
          <div className="why-choose__content why-choose__content-home">
            <div className="why-choose__text">
              <span className="sub-title d-block fw-500 color-red text-uppercase mb-sm-10 mb-xs-5 mb-15">
                <img src="/assets/img/home/line.svg" className="img-fluid mr-10" alt="" loading="lazy" decoding="async" /> Jobly
              </span>
              <h2 className="title color-pd_black">How We Work</h2>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="why-choose__content why-choose__content-home mt-md-25 mt-sm-20 mt-xs-20">
            <div className="description font-la">
              <p>Three stages, the same team throughout. No handover to a delivery pod you have never met, and no disappearing once the contract is signed.</p>
            </div>
            <Link to="/contact" className="theme-btn btn-sm btn-red mt-30 mt-sm-25 mt-xs-20">
              Talk To Us<i className="far fa-chevron-double-right"></i>
            </Link>
          </div>
        </div>
      </div>

      <div className="row">
        {steps.map(s => (
          <div key={s.title} className="col-xl-4 col-md-6 col-12 mb-30">
            <div className="why-choose__item why-choose__item-two hover-lift" style={{ backgroundImage: 'url(/assets/img/home/why-choose__item-two-overly.png)' }}>
              <div className="icon mb-30 mb-lg-20 mb-md-10 mb-xs-5 color-red">
                <img src={s.img} alt="" loading="lazy" decoding="async" />
              </div>
              <h6 className="title color-pd_black fw-600 mb-15 mb-xs-10">
                <span className="color-red mr-10">{s.step}</span>{s.title}
              </h6>
              <div className="description font-la mb-20 mb-sm-15 mb-xs-10">
                <p>{s.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
  );
};

export default HowWeWork;
