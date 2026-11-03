import { build } from 'esbuild';
import fs from 'fs';
const F = (p) => fs.readFileSync(p).toString('base64');
const fdir = 'node_modules/@fontsource';
const face = (name, file, weight, range) => `@font-face{font-family:'${name}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${F(file)}) format('woff2');unicode-range:${range};}`;
const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+2190-21FF';
const fonts = [
  face('Wet', `${fdir}/rubik-wet-paint/files/rubik-wet-paint-cyrillic-400-normal.woff2`, 400, CYR),
  face('Wet', `${fdir}/rubik-wet-paint/files/rubik-wet-paint-latin-400-normal.woff2`, 400, LAT),
  face('Osw', `${fdir}/oswald/files/oswald-cyrillic-400-normal.woff2`, 400, CYR),
  face('Osw', `${fdir}/oswald/files/oswald-latin-400-normal.woff2`, 400, LAT),
  face('Osw', `${fdir}/oswald/files/oswald-cyrillic-600-normal.woff2`, 600, CYR),
  face('Osw', `${fdir}/oswald/files/oswald-latin-600-normal.woff2`, 600, LAT),
].join('\n');
const r = await build({ entryPoints: ['src/game.js'], bundle: true, minify: true, format: 'iife', target: ['es2020'], write: false });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('src/index.html', 'utf8').replace('/*FONTS*/', () => fonts).replace('/*DANCE*/', () => fs.existsSync('assets/dance.mp3') ? F('assets/dance.mp3') : '').replace('/*SHAHED*/', () => fs.existsSync('assets/shahed.mp3') ? F('assets/shahed.mp3') : '').replace('/*CH2INTRO*/', () => fs.existsSync('assets/ch2intro.mp3') ? F('assets/ch2intro.mp3') : '').replace('/*ADAM*/', () => fs.existsSync('assets/adam.mp3') ? F('assets/adam.mp3') : '').replace('<script>/*GAME*/</script>', () => '<script>' + js + '</script>');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
