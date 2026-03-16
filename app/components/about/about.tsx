export default function About() {
  return (
    <div className="mx-auto pt-32 text-center">
      <h1 className="text-5xl font-bold text-page-fg dark:text-page-fg-dark sm:text-7xl">
        Dexter Young
      </h1>

      {/* <p>CS Student at McGill</p>
      <h2 className="text-4xl">Contact me:</h2> */}
      <div className="mt-5 hidden justify-center gap-5 text-lg sm:flex">
        <a href="https://github.com/TheTexta" className="link-normalized">
          GitHub: @TheTexta
        </a>
        <a
          href="https://www.linkedin.com/in/dexter-y"
          className="link-normalized"
        >
          LinkedIn: dexter-y
        </a>
        <a href="mailto:dextery777@gmail.com" className="link-normalized">
          Email: dextery777@gmail.com
        </a>
      </div>
      <div className="flex-col-3 mt-5 flex justify-center gap-5 sm:hidden">
        <a href="https://github.com/TheTexta" className="block link-normalized">
          GitHub
        </a>
        <a
          href="https://www.linkedin.com/in/dexter-y"
          className="block link-normalized"
        >
          LinkedIn
        </a>
        <a href="mailto:dextery777@gmail.com" className="block link-normalized">
          Email
        </a>
      </div>
    </div>
  );
}
