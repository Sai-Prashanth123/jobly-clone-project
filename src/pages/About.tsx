import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';

const About = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner.jpg"
        transparentText="About Us"
        title={<>About <span>Company</span></>}
        breadcrumb="About Us"
      />

      {/* our-company start */}
      <section className="our-company pt-xs-80 pb-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-120 pb-120 overflow-hidden">
        <div className="container">
          <div className="row">
            <div className="col-lg-3 col-sm-6">
              <div className="our-company__meida">
                <img src="/assets/img/about/2c.png" alt="" className="img-fluid" />
              </div>
            </div>

            <div className="col-lg-3 col-sm-6">
              <div className="our-company__meida border-radius">
                <img src="/assets/img/about/2d.png" alt="" className="img-fluid" />
                <div className="horizental-bar"></div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="our-company__content mt-md-50 mt-sm-40 mt-xs-35">
                <span className="sub-title fw-500 color-primary text-uppercase mb-sm-10 mb-xs-5 mb-20 d-block">
                  <img src="/assets/img/team-details/badge-line.svg" className="img-fluid mr-10" alt="" /> About us
                </span>
                <h2 className="title color-d_black mb-20 mb-sm-15 mb-xs-10">We are a customer centrical group of technologists</h2>

                <div className="descriiption font-la mb-30 mb-md-25 mb-sm-20 mb-xs-15">
                  <p>An exhaustive accumulation of administrations. We make it our business to perceive your coveted course of bearing, the complexities of your profession, your business works on, working demeanor and your primary concerns. Along these lines we have permitted us to outperform desires and convey arrangements that are fitting to coordinate your business needs.</p>
                  <p>Jobly Solutions is a leading manpower consulting and recruitment company that offers top-notch staffing solutions to businesses across various industries. Our company was established in 2022 with a mission to connect the right talent with the right job, and we have been fulfilling this mission ever since.</p>
                </div>

                <div className="client-feedback d-flex flex-column flex-sm-row">
                  <div className="client-feedback__item text-center">
                    <div className="client-feedback__item-header">
                      <span className="color-primary font-la fw-600 text-uppercase">Success Project</span>
                    </div>
                    <div className="client-feedback__item-body">
                      <div className="number mb-10 mb-xs-5 color-d_black fw-600">+<span className="counter">95</span>%</div>
                      <div className="description font-la mb-10 mb-xs-5"></div>
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

                  <div className="client-feedback__item text-center">
                    <div className="client-feedback__item-header">
                      <span className="color-primary font-la fw-600 text-uppercase">Customer Review</span>
                    </div>
                    <div className="client-feedback__item-body">
                      <div className="number mb-10 mb-xs-5 color-d_black fw-600">+<span className="counter">4.7</span></div>
                      <div className="description font-la mb-10 mb-xs-5"></div>
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
      {/* our-company end */}

      {/* company-skill start */}
      <section className="company-skill pt-xs-80 pb-xs-80 pt-sm-100 pt-md-100 pt-120 pb-100 overflow-hidden">
        <div className="container">
          <div className="row">
            <div className="col-xl-6">
              <div className="company-skill__content">
                <span className="sub-title d-block fw-500 color-primary text-uppercase mb-sm-10 mb-xs-5 mb-md-15 mb-20">
                  <img src="/assets/img/team-details/badge-line.svg" className="img-fluid mr-10" alt="" />Mission
                </span>
                <div className="description font-la">
                  Giving quality and beneficial programming answers for our predominant customers in which we give the most best in class and quality items and administrations to the business. At Jobly, we battle day by day to upgrade ourselves. Decided day by day to build up our total throughputs and advance our groups is a day by day objective and a keenness of gaudiness. Therefore, we have molded a more advantageous and results concentrated on workplace.
                </div><br />
                <span className="sub-title d-block fw-500 color-primary text-uppercase mb-sm-10 mb-xs-5 mb-md-15 mb-20">
                  <img src="/assets/img/team-details/badge-line.svg" className="img-fluid mr-10" alt="" />Vision
                </span>
                <div className="description font-la">
                  Creating new milestones in knowledge and skill enhancement. Empowering higher education aspirants in their quest for excellence and global careers.
                </div><br />
                <span className="sub-title d-block fw-500 color-primary text-uppercase mb-sm-10 mb-xs-5 mb-md-15 mb-20">
                  <img src="/assets/img/team-details/badge-line.svg" className="img-fluid mr-10" alt="" />Culture
                </span>
                <div className="description font-la">
                  A certainty that our faculty discover "work" intriguing, duty to unwavering quality in the work environment and exceptional expert direct. We have a honest enthusiasm for verifying that individuals' vocation advantages and desire are focused - by encouraging instructive and preparing openings. We have an open entryway methodology which moves brought together sharing of data. We comprehend that contestants require a robust and healthy work-life balance.
                </div>
              </div>
            </div>

            <div className="col-xl-6">
              <div className="company-skill__media-wrapper d-flex flex-column mt-lg-60 mt-md-50 mt-sm-45 mt-xs-40 align-items-center">
                <div className="company-skill__media">
                  <img src="/assets/img/about/company-skill-meida.png" alt="" className="img-fluid" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* company-skill end */}
    </PageLayout>
  );
};

export default About;
