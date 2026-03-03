
export default function About() {
  return (
    <div className="mx-auto text-center pt-32">
      <h1 className="text-5xl sm:text-7xl font-bold">Dexter Young</h1>

      {/* <p>CS Student at McGill</p>
      <h2 className="text-4xl">Contact me:</h2> */}
      <div className="justify-center gap-5 mt-5 text-lg hidden sm:flex">
        <a href="https://github.com/TheTexta" className="hover:underline">
          GitHub: @TheTexta
        </a>
        <a
          href="https://www.linkedin.com/in/dexter-y"
          className="hover:underline"
        >
          LinkedIn: dexter-y
        </a>
        <a href="mailto:dextery777@gmail.com" className="hover:underline">
          Email: dextery777@gmail.com
        </a>
      </div>
      <div className="sm:hidden flex gap-5 mt-5 flex-col-3 justify-center">
        <a href="https://github.com/TheTexta" className="block hover:underline">
          GitHub
        </a>
        <a
          href="https://www.linkedin.com/in/dexter-y"
          className="block hover:underline"
        >
          LinkedIn
        </a>
        <a href="mailto:dextery777@gmail.com" className="block hover:underline">
          Email
        </a>
      </div>
    </div>
  );
}
