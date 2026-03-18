import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';

const Careers = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner2.jpg"
        transparentText="Careers"
        title={<>Careers <span></span></>}
        breadcrumb="Careers"
      />

      {/* our-company start */}
      <section className="our-company pt-xs-80 pb-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-120 pb-120 overflow-hidden">
        <div className="container">
          <div className="row">
            <div className="col-lg-3 col-sm-6">
              <div className="our-company__meida">
                <img src="/assets/img/about/2b.png" alt="" className="img-fluid" />
              </div>
            </div>

            <div className="col-lg-3 col-sm-6">
              <div className="our-company__meida border-radius">
                <img src="/assets/img/about/2a.png" alt="" className="img-fluid" />
                <div className="horizental-bar"></div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="our-company__content mt-md-50 mt-sm-40 mt-xs-35">
                <span className="sub-title fw-500 color-primary text-uppercase mb-sm-10 mb-xs-5 mb-20 d-block">
                  <img src="/assets/img/team-details/badge-line.svg" className="img-fluid mr-10" alt="" /> Careers
                </span>

                <div className="descriiption font-la mb-30 mb-md-25 mb-sm-20 mb-xs-15">
                  <p>Jobly offers flexible benefit packages to meet the personal needs of our employees and their families. We strive to be an employer of choice, and our Human Resources Department works hard to ensure that our benefit plans are competitive and comprehensive. Jobly approaches benefits in a holistic fashion – we go beyond basic healthcare and consider all of our employee needs. We provide broad health coverage and tremendous options for tuition reimbursement, green card assistance, personal time and more.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* our-company end */}
    </PageLayout>
  );
};

export default Careers;
