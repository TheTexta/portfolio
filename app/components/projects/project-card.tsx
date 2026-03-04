import { ReactNode } from "react";

type ProjectCardProps = {
  title: string;
  description: string;
  tags: string[];
  children: ReactNode;
};

// TODO: Better scaling for mobile UI.
export default function ProjectCard({
  title,
  description,
  tags,
  children,
}: ProjectCardProps) {
  return (
    <article className="rounded-xl w-full md:w-5/6 max-w-3xl  justify-self-center">
      <header className="mb-4">
        <h3 className="text-xl sm:text-2xl font-semibold">{title}</h3>
        <p className="mt-2 text-sm">{description}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag} className="rounded-md bg-white/10 px-2 py-1 text-xs">
              {tag}
            </li>
          ))}
        </ul>
      </header>
      <div className="relative overflow-hidden rounded-md mx-auto aspect-video">{children}</div>
    </article>
  );
}
