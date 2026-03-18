import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';

const Technology = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner3.jpg"
        transparentText="Technology"
        title={<>Technology <span></span></>}
        breadcrumb="Technology"
      />

      <section className="pt-xs-60 pt-sm-80 pt-100 pb-xs-60 pb-sm-80 pb-100">
        <div className="container">
          <div className="row g-4">
            {['1.jpg','1b.jpg','1c.jpg','1d.jpg','1e.jpg','salesforce.png','1g.jpg','1f.jpg','1h.jpg','1i.jpg','1j.jpg'].map((f, i) => (
              <div key={i} className="col-lg-4 col-md-6 col-6">
                <img src={`/assets/img/technologies/${f}`} alt="" className="img-fluid" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Technology;
