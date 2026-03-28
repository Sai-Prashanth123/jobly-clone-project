import { Link } from 'react-router-dom';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const CareersSection = () => {
  const sectionRef = useScrollReveal<HTMLDivElement>('animate__fadeIn', 0.15, '0.2s');
  return (
  <section
    className="planning-success pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-120 pb-130 overflow-hidden"
    style={{ backgroundImage: 'url(/assets/img/home/planning-success-bg.png)' }}
  >
    <div ref={sectionRef} className="container">
      <div className="row align-items-center">
        <div className="col-md-8">
          <div className="planning-success__content mb-xs-35">
            <h2 className="title mb-20 mb-sm-15 mb-xs-10 color-white">Careers</h2>
            <div className="description font-la color-white mb-40 mb-sm-30 mb-xs-20">
              <p>Jobly offers flexible benefit packages to meet the personal needs of our employees and their families. We strive to be an employer of choice, and our Human Resources Department works hard to ensure that our benefit plans are competitive and comprehensive.</p>
            </div>
            <Link to="/careers" className="theme-btn btn-sm btn-red">
              Read More <i className="far fa-chevron-double-right"></i>
            </Link>
          </div>
        </div>
        <div className="col-md-4">
          <img src="/assets/img/home/our1.png" className="img-fluid" alt="" />
        </div>
      </div>
    </div>
  </section>
  );
};

export default CareersSection;
