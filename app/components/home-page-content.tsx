import {
  HomeContactLink,
  HomeEditorialRule,
  HomePageInteractions,
  HomeProjectBrowser,
  HomeProjectDirectory,
} from "@/app/components/home-page-interactions";
import WriteUpList from "@/app/components/projects/write-up-list";
import { projectCatalog } from "@/app/components/projects/project-catalog";
import {
  BorderContainer,
  BORDER_CONTAINER_TEXT_SCALE_CLASS,
  EditorialRuleHeading,
  SiteHeader,
} from "@/app/components/ui/editorial";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import { cn } from "@/lib/cn";

function HomeLinkRow({
  label,
  href,
  value,
}: {
  label: string;
  href: string;
  value?: string;
}) {
  return (
    <li className="flex min-h-12 items-center border-b border-ink last:border-b-0">
      <HomeContactLink href={href}>
        <span className="relative z-10 min-w-0 truncate text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm">
          {label}
        </span>
        {value ? (
          <span className="relative z-10 ml-auto truncate text-xs sm:text-sm">
            {value}
          </span>
        ) : null}
      </HomeContactLink>
    </li>
  );
}

const writeUpProjects = projectCatalog.filter((project) => project.writeUpHref);

export default function HomePageContent() {
  return (
    <HomePageInteractions>
      <main className="min-h-dvh overflow-x-clip bg-canvas text-ink">
        <SiteHeader directory={<HomeProjectDirectory />}>
          <a
            href="#about"
            className="flex min-h-7 items-center transition-opacity hover:opacity-55"
          >
            About
          </a>
          <ThemeToggle className="hidden sm:inline-flex" />
        </SiteHeader>

        <section className="py-36 sm:py-20 lg:py-24">
          <div className="space-y-12 px-5 sm:space-y-4 sm:px-8 lg:px-12">
            <HomeEditorialRule>
              <p className="text-center text-xs font-semibold tracking-[0.18em] uppercase">
                Software development + interactive media
              </p>
            </HomeEditorialRule>
            <div className="mx-auto w-[calc(100%-2.5rem)] max-w-200 py-12 sm:h-82.5 sm:w-[calc(100%-4rem)] lg:w-[calc(100%-6rem)] lg:max-w-225">
              <BorderContainer className="h-auto grid-rows-[minmax(1.5rem,1fr)_auto_minmax(1.5rem,1fr)] sm:h-full">
                <h1
                  className={cn(
                    BORDER_CONTAINER_TEXT_SCALE_CLASS,
                    "object-center px-2 py-4 text-center font-display leading-[0.7705] font-semibold tracking-tighter max-sm:text-[clamp(3rem,15vw,4.5rem)] lg:py-8",
                  )}
                >
                  Dexter Young
                </h1>
              </BorderContainer>
            </div>
            <HomeEditorialRule>
              <p className="text-center text-xs font-semibold tracking-[0.18em] uppercase">
                Multimedia webworks, browser extensions and interactive image
                systems
              </p>
            </HomeEditorialRule>
          </div>
        </section>
        <HomeProjectBrowser />

        <section
          id="about"
          tabIndex={-1}
          aria-label="About"
          className="scroll-mt-12 py-12 outline-none sm:pt-20 sm:pb-0 lg:pt-24"
        >
          <EditorialRuleHeading>About</EditorialRuleHeading>
          <div className="px-5 py-4 sm:px-8 sm:pt-10 lg:px-12">
            <div className="mx-auto grid max-w-228.25 gap-8 md:grid-cols-2 md:gap-12">
              <div
                data-about-introduction
                className="space-y-5 text-base leading-[1.8]"
              >
                <p>
                  I’m a software developer studying computer science at McGill,
                  with a minor in music technology. I’m interested in how
                  software shapes the way people present and explore visual
                  media. My projects include photography galleries organised
                  around colour and node graphs, alongside interactive 3D
                  portfolios.
                </p>
                <p>
                  At TVM, McGill’s student television service, I develop a
                  Discord bot that supports membership and production workflows.
                  As Technical Director, I also manage a CAD $15,000 equipment
                  budget, maintain servers and lead workshops for a community of
                  150 members.
                </p>
                <p>
                  I’m also interested in making second-hand shopping easier. I
                  develop Grailed Plus, an open-source browser extension that
                  helps shoppers compare resale listings across marketplaces and
                  uses on-device image matching to find similar items.
                </p>
              </div>

              <div className="flex min-w-0 flex-col md:h-0 md:min-h-full">
                <BorderContainer
                  data-write-up-frame
                  className="h-auto grid-rows-[1.5rem_minmax(0,1fr)_1.5rem] md:h-full"
                  centerWidth="calc(100% - 2rem)"
                  topLabel={
                    <h3 className="font-sans text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm">
                      Write ups
                    </h3>
                  }
                >
                  <WriteUpList projects={writeUpProjects} />
                </BorderContainer>
              </div>
            </div>
          </div>
        </section>

        <footer
          tabIndex={-1}
          id="contact"
          className="scroll-mt-12 py-12 outline-none sm:py-20 lg:py-24"
        >
          <EditorialRuleHeading>Contact</EditorialRuleHeading>
          <div className="flex justify-center px-5 py-4 sm:px-8 sm:pt-10 lg:px-12">
            <BorderContainer className="h-60 w-full max-w-228.25 sm:h-68.25">
              <ul className="grid grid-rows-4">
                {[
                  ["GitHub", "https://github.com/TheTexta", "@TheTexta"],
                  [
                    "LinkedIn",
                    "https://www.linkedin.com/in/dexter-y",
                    "dexter-y",
                  ],
                  [
                    "Email",
                    "mailto:dextery777@gmail.com",
                    "dextery777@gmail.com",
                  ],
                  ["Resume", "/Dexter_Young_CV.pdf", "Download PDF"],
                ].map(([label, href, value]) => (
                  <HomeLinkRow
                    key={label}
                    label={label}
                    href={href}
                    value={value}
                  />
                ))}
              </ul>
            </BorderContainer>
          </div>
        </footer>
      </main>
    </HomePageInteractions>
  );
}
