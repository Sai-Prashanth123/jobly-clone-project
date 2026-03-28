import { useScrollReveal } from '@/hooks/useScrollReveal';

const GetInTouch = () => {
  const sectionRef = useScrollReveal<HTMLDivElement>('animate__fadeIn', 0.15, '0s');
  return (
  <section ref={sectionRef} className="can-help can-help-home-1 pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-120 pb-120 overflow-hidden">
      <div className="can-help-background" style={{ backgroundImage: 'url(/assets/img/home/can-help-background.png)' }}></div>
      <div className="container">
        <div className="row">
          <div className="col-xl-7">
            <div className="can-help__content mb-sm-40 mb-xs-40 mb-md-45 mb-lg-50">
              <h2 className="title color-white mb-sm-15 mb-xs-10 mb-20">Get In Touch</h2>
              <div className="description font-la mb-md-25 mb-sm-25 mb-xs-20 mb-lg-30 mb-40 color-white">
                <p>We genuinely have certainty that business elements develop and advance not just through the movement in their particular organizations additionally by designing a situation which consoles self-examination and enablement.</p>
              </div>
              <div className="can-help__content-btn-group d-flex flex-column flex-sm-row">
                <a href="tel:+14048635745" className="theme-btn d-flex flex-column flex-md-row align-items-md-center">
                  <div className="icon color-red"><i className="fas fa-phone-alt"></i></div>
                  <div className="text">
                    <span className="font-la mb-10 d-block fw-500 color-white">Call Us</span>
                    <h5 className="fw-500 color-white">+1 404-863-5745</h5>
                  </div>
                </a>
                <a href="mailto:info@joblysolutions.com" className="theme-btn d-flex flex-column flex-md-row align-items-md-center">
                  <div className="icon color-red"><i className="fas fa-envelope"></i></div>
                  <div className="text">
                    <span className="font-la mb-10 d-block fw-500 color-white">Email Drop Us</span>
                    <h5 className="fw-500 color-white">info@joblysolutions.com</h5>
                  </div>
                </a>
              </div>
            </div>
          </div>
          <div className="col-xl-5">
            <div className="contact-form pt-md-30 pt-sm-25 pt-xs-20 pb-md-40 pb-sm-35 pb-xs-30 pt-xl-30 pb-xl-50 pt-45 pr-xl-50 pl-md-40 pl-sm-30 pl-xs-25 pr-md-40 pr-sm-30 pr-xs-25 pl-xl-50 pr-85 pb-60 pl-85">
              <div className="contact-form__header mb-sm-35 mb-xs-30 mb-40">
                <h6 className="sub-title fw-500 color-red text-uppercase mb-15">
                  <img src="/assets/img/home/line.svg" className="img-fluid mr-10" alt="" /> Get In Touch
                </h6>
                <h3 className="title color-d_black">Free Consultation</h3>
              </div>
              <form className="hm_contact_form" onSubmit={e => e.preventDefault()}>
                <div className="single-personal-info form_row clearfix">
                  <input className="form_fill_fields hm_input_text form-control" type="text" placeholder="Full Name" required />
                </div>
                <div className="single-personal-info form_row clearfix">
                  <input className="form_fill_fields hm_input_text form-control" type="email" placeholder="Enter Email" required />
                </div>
                <div className="single-personal-info form_row clearfix">
                  <input className="form_fill_fields hm_input_text form-control" type="text" placeholder="Phone No" />
                </div>
                <div className="single-personal-info form_row clearfix">
                  <input className="form_fill_fields hm_input_text form-control" type="text" placeholder="Subject" required />
                </div>
                <div className="single-personal-info form_row clearfix">
                  <textarea className="form_fill_fields hm_textarea form-control" placeholder="Message" required></textarea>
                </div>
                <div className="form_row clearfix">
                  <button type="submit" className="send_button full_button default-btn btn-two theme-btn btn-sm btn-red">
                    <span>Send Your Message</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GetInTouch;
