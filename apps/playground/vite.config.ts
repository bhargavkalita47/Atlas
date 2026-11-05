import {defineConfig,type Plugin} from "vite";
import react from "@vitejs/plugin-react";

/**
 * Atlas Lab starts in vector mode. Preload only its fingerprinted JavaScript
 * entry so the browser can download the renderer while the shell starts.
 * Never preload raster assets or speculative geographic tiles.
 *
 * This is a build-only HTML hint: Atlas's @atlas/react SDK remains bundler
 * independent and the Vite dev server works normally without the generated
 * filename.
 */
function preloadDefaultVector():Plugin {
  return {
    name:"atlas-preload-vector-entry",
    apply:"build",
    transformIndexHtml:{
      order:"post",
      handler(_html,ctx){
        const chunk=Object.values(ctx.bundle??{}).find(item=>
          item.type==="chunk" &&
          item.facadeModuleId?.replaceAll("\\","/").endsWith("/src/VectorMapLoader.tsx")
        );
        if(!chunk)throw new Error("Could not locate the Atlas vector entry chunk for preload.");
        return [{
          tag:"link",
          attrs:{
            rel:"modulepreload",
            href:"/"+chunk.fileName,
            crossorigin:"",
            fetchpriority:"low"
          },
          injectTo:"head"
        }];
      }
    }
  };
}

export default defineConfig({
  plugins:[react(),preloadDefaultVector()],
  server:{port:5173},
  build:{outDir:"dist",emptyOutDir:true}
});
