import { useCounterUp } from '@/hooks/useCounterUp';

const AboutSection = () => {
  useCounterUp();
  return (
    <section className="our-company pb-xs-80 pb-100 overflow-hidden">
      <div className="container">
        <div className="row">
          <div className="col-lg-3 col-sm-6">
            <div className="our-company__meida">
              <img src="/assets/img/about/2e.png" alt="" className="img-fluid" />
            </div>
          </div>
          <div className="col-lg-3 col-sm-6">
            <div className="our-company__meida border-radius">
              <img src="/assets/img/about/2d.png" alt="" className="img-fluid" />
              <div className="horizental-bar bg-red"></div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="our-company__content mt-md-50 mt-sm-40 mt-xs-35">
              <span className="sub-title fw-500 color-red text-uppercase mb-sm-10 mb-xs-5 mb-20 d-block">
                <img src="/assets/img/home/line.svg" className="img-fluid mr-10" alt="" /> Jobly
              </span>
              <h2 className="title color-pd_black mb-20 mb-sm-15 mb-xs-10">About Us</h2>
              <div className="descriiption font-la mb-30 mb-md-25 mb-sm-20 mb-xs-15">
                <p>Jobly Solutions is a leading manpower consulting and recruitment company that offers top-notch staffing solutions to businesses across various industries. Our company was established in 2022 with a mission to connect the right talent with the right job, and we have been fulfilling this mission ever since.</p>
              </div>
              <div className="client-feedback d-flex flex-column flex-sm-row">
                <div className="client-feedback__item client-feedback__item-two text-center">
                  <div className="client-feedback__item-header">
                    <span className="color-red font-la fw-600 text-uppercase">Success Project</span>
                  </div>
                  <div className="client-feedback__item-body">
                    <div className="number mb-10 mb-xs-5 color-pd_black fw-600">+<span className="counter">95</span>%</div>
                    <div className="starts">
                      <ul>
                        <li><span></span></li>
                        <li><span></span></li>
                        <li><span></span></li>
                        <li><span></span></li>
                        <li><span></span></li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="client-feedback__item client-feedback__item-two text-center">
                  <div className="client-feedback__item-header">
                    <span className="color-red font-la fw-600 text-uppercase">Customer Review</span>
                  </div>
                  <div className="client-feedback__item-body">
                    <div className="number mb-10 mb-xs-5 color-pd_black fw-600">+4.7</div>
                    <div className="starts">
                      <ul>
                        <li><span></span></li>
                        <li><span></span></li>
                        <li><span></span></li>
                        <li><span></span></li>
                        <li><span></span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
