const CareersSection = () => {
  return (
    <section className="bg-jobly-navy py-20 px-4 lg:px-[60px]">
      <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-12 items-center">
        <div className="text-primary-foreground">
          <h2 className="text-[36px] font-bold mb-6">Careers</h2>
          <p className="text-primary-foreground/75 text-[16px] leading-[1.8] mb-8">
            Jobly offers flexible benefit packages to meet the personal needs of our employees and their families. We strive to be an employer of choice, and our Human Resources Department works hard to ensure that our benefit plans are competitive and comprehensive.
          </p>
          <div className="bg-jobly-blue text-primary-foreground px-7 py-3 rounded inline-flex items-center gap-2 font-semibold cursor-pointer hover:brightness-90 transition-all">
            Read More <span>→</span>
          </div>
        </div>

        <div className="flex justify-center">
          <img
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80"
            alt="Team"
            className="rounded-lg max-h-[350px] object-cover opacity-80"
          />
        </div>
      </div>
    </section>
  );
};

export default CareersSection;
