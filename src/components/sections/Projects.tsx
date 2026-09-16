import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { ExternalLink, Layers, Code, Sparkles } from 'lucide-react';
import { GithubIcon } from '../ui/Icons';

export const Projects: React.FC = () => {
  const { projects } = useStore();
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Extract unique tags
  const allTags = ['All', ...Array.from(new Set(projects.flatMap((p) => p.tags || [])))];

  const filteredProjects = selectedTag === 'All'
    ? projects
    : projects.filter((p) => p.tags && p.tags.includes(selectedTag));

  return (
    <section id="projects" className="py-24 relative bg-dark-950 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            Portfolio Showcase
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Crafted for Performance & Conversions
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Hover over any project mockup to smoothly preview the full long-page layout.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-14">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-2 rounded-xl text-xs font-mono transition-all duration-200 ${
                selectedTag === tag
                  ? 'bg-cyber-accent text-dark-950 font-bold shadow-neon-sm'
                  : 'bg-dark-900 text-gray-400 border border-white/10 hover:border-cyber-accent/40 hover:text-white'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="group glass-panel rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 overflow-hidden shadow-2xl flex flex-col justify-between"
            >
              {/* Browser Mockup Top Bar */}
              <div className="px-4 py-3 bg-dark-950/80 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  <span className="text-[11px] font-mono text-gray-400 ml-2 truncate max-w-[200px]">
                    {project.title.toLowerCase().replace(/\s+/g, '-')}.fazal.dev
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyber-neon bg-cyber-dim px-2 py-0.5 rounded border border-cyber-accent/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Hover to Scroll Page</span>
                </div>
              </div>

              {/* Long Screenshot Container */}
              <div className="relative h-72 w-full overflow-hidden bg-dark-950 cursor-pointer">
                <img
                  src={project.image_url}
                  alt={project.title}
                  className="w-full object-cover object-top transition-transform duration-[4500ms] ease-in-out group-hover:-translate-y-[calc(100%-18rem)]"
                  style={{ minHeight: '100%' }}
                />

                {/* Subtle Gradient Hint */}
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-dark-950 to-transparent pointer-events-none opacity-60 group-hover:opacity-0 transition-opacity" />
              </div>

              {/* Project Info */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-5 bg-dark-900/60">
                <div className="space-y-2.5">
                  <h3 className="text-xl font-bold text-white font-sans group-hover:text-cyber-neon transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                    {project.description}
                  </p>
                </div>

                {/* Tags & Action Links */}
                <div className="space-y-4 pt-3 border-t border-white/5">
                  <div className="flex flex-wrap gap-1.5">
                    {project.tags?.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-dark-950 border border-white/10 text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3">
                      {project.live_url && (
                        <a
                          href={project.live_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyber-neon hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Live Demo</span>
                        </a>
                      )}
                      {project.github_url && (
                        <a
                          href={project.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 hover:text-white"
                        >
                          <GithubIcon className="w-3.5 h-3.5" />
                          <span>Code Repository</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
