import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';

const Clients = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner4.jpg"
        transparentText="Clients"
        title={<>Clients <span></span></>}
        breadcrumb="Clients"
      />

      <section className="pt-xs-60 pt-sm-80 pt-100 pb-xs-60 pb-sm-80 pb-100">
        <div className="container">
          <div className="row g-4">
            {['client7a.jpg','client7b.jpg','client7c.jpg','client7d.jpg','client7e.jpg','client7f.jpg','client7.jpg','client7g.jpg','client7h.jpg'].map((f, i) => (
              <div key={i} className="col-lg-4 col-md-6 col-6">
                <img src={`/assets/img/clients/${f}`} alt="" className="img-fluid" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Clients;
