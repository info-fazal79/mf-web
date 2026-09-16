import React from 'react';
import { SKILLS_LIST } from '../../lib/initialData';
import { FileSpreadsheet, Table, Code2, Cloud, Globe, CheckCircle2 } from 'lucide-react';

export const Skills: React.FC = () => {
  const getIcon = (name: string) => {
    switch (name) {
      case 'FileSpreadsheet':
        return <FileSpreadsheet className="w-8 h-8 text-emerald-400" />;
      case 'Table':
        return <Table className="w-8 h-8 text-green-400" />;
      case 'Code2':
        return <Code2 className="w-8 h-8 text-cyan-400" />;
      case 'Cloud':
        return <Cloud className="w-8 h-8 text-blue-400" />;
      case 'Globe':
        return <Globe className="w-8 h-8 text-cyber-neon" />;
      default:
        return <Code2 className="w-8 h-8 text-cyber-neon" />;
    }
  };

  return (
    <section id="skills" className="py-24 relative bg-dark-950 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-dim border border-cyber-accent/30 text-cyber-neon text-xs font-mono font-bold tracking-widest uppercase">
            Core Arsenal
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
            Software's for Projects
          </h2>
          <p className="text-gray-400 text-sm sm:text-base">
            Engineered workflows and productivity stacks mastered through thousands of hours of real-world implementation.
          </p>
        </div>

        {/* 5-Card Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {SKILLS_LIST.map((skill, index) => (
            <div
              key={index}
              className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-cyber-accent/40 transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1 shadow-lg"
            >
              <div className="space-y-4">
                {/* Icon & Badge */}
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-xl bg-dark-900 border border-white/10 flex items-center justify-center group-hover:border-cyber-accent/40 group-hover:shadow-neon-sm transition-all">
                    {getIcon(skill.iconName)}
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyber-dim border border-cyber-accent/30 text-cyber-neon">
                    {skill.badge}
                  </span>
                </div>

                {/* Skill Name & Level */}
                <div>
                  <h3 className="text-lg font-bold text-white font-sans group-hover:text-cyber-neon transition-colors">
                    {skill.name}
                  </h3>
                  <div className="text-xs font-mono text-gray-400 mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyber-accent" />
                    <span>{skill.level}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-400 leading-relaxed">
                  {skill.description}
                </p>
              </div>

              {/* Progress Bar Micro-interaction */}
              <div className="pt-6">
                <div className="w-full bg-dark-900 rounded-full h-1.5 overflow-hidden border border-white/5">
                  <div
                    className="bg-gradient-to-r from-cyber-accent to-cyber-neon h-full rounded-full transition-all duration-1000 group-hover:shadow-neon-sm"
                    style={{
                      width: skill.level.includes('98')
                        ? '98%'
                        : skill.level.includes('96')
                        ? '96%'
                        : skill.level.includes('95')
                        ? '95%'
                        : skill.level.includes('92')
                        ? '92%'
                        : '90%',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
