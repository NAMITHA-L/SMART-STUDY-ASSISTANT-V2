const fs = require('fs');

function replaceColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace colors
  content = content.replace(/bg-white/g, 'bg-[#05472A]');
  content = content.replace(/text-\[#0a192f\]/g, 'text-white');
  content = content.replace(/border-\[#0a192f\]/g, 'border-white');
  content = content.replace(/_#0a192f/g, '_white');
  content = content.replace(/bg-\[#0a192f\]/g, 'bg-white');
  content = content.replace(/bg-blue-50/g, 'bg-white/10');
  content = content.replace(/text-emerald-600/g, 'text-green-300');
  content = content.replace(/text-rose-600/g, 'text-red-300');
  content = content.replace(/border-rose-500/g, 'border-red-400');
  content = content.replace(/bg-rose-50/g, 'bg-red-900/50');
  content = content.replace(/text-rose-700/g, 'text-red-200');
  content = content.replace(/text-slate-600/g, 'text-white/70');
  content = content.replace(/text-slate-800/g, 'text-white');
  content = content.replace(/bg-slate-50/g, 'bg-[#05472A]');
  content = content.replace(/bg-slate-100/g, 'bg-white/10');
  content = content.replace(/bg-slate-200/g, 'bg-white/20');
  content = content.replace(/border-slate-200/g, 'border-white/20');
  content = content.replace(/border-slate-300/g, 'border-white/30');
  content = content.replace(/text-slate-500/g, 'text-white/60');
  content = content.replace(/text-gray-600/g, 'text-white/70');
  content = content.replace(/text-gray-800/g, 'text-white');
  content = content.replace(/bg-gray-50/g, 'bg-[#05472A]');
  content = content.replace(/bg-gray-100/g, 'bg-white/10');
  content = content.replace(/border-gray-200/g, 'border-white/20');
  
  // Fix hover states for white text on white bg
  content = content.replace(/hover:bg-white\/10 text-white/g, 'hover:bg-white hover:text-[#05472A] text-white');
  
  fs.writeFileSync(filePath, content, 'utf8');
}

replaceColors('./App.tsx');
replaceColors('./components/ResultsView.tsx');
console.log('Colors replaced successfully!');
