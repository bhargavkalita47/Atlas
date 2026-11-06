import {
  ATLAS_STYLE_PRESETS,createAtlasPresetDocument,reskinAtlasPreset,
  type AtlasStyleDocument,type StyleLayerDescriptor
} from "@atlas/style-core";

/**
 * Atlas Lab ONLY: retain 81 base preset documents for the current layer
 * inventory and an LRU of user-defined palettes. Native MapLibre style,
 * vector tiles and source loading are NOT cached here.
 *
 * Presets share the currently selected vector base, allowing theme changes
 * to go through the incremental paint/layout adapter instead of setStyle().
 * Users can explicitly change the base style to compare provider details.
 */
export class StudioPresetCache {
  private inventoryKey="";
  private baseId="positron";
  private layers:readonly StyleLayerDescriptor[]=[];
  private originals=new Map<string,AtlasStyleDocument>();
  private palettes=new Map<string,AtlasStyleDocument>();
  private readonly paletteLimit=32;

  get size():number{return this.originals.size;}
  get baseStyle():string{return this.baseId;}
  get ready():boolean{return this.originals.size===ATLAS_STYLE_PRESETS.length;}

  /**
   * Precompute every built-in theme once after the map exposes its loaded,
   * exact layer inventory. Idempotent for the same base + same layer IDs.
   */
  prepare(baseId:string,layers:readonly StyleLayerDescriptor[]):boolean{
    const key=JSON.stringify([baseId,layers.map(l=>[l.id,l.type,l.suggestedGroup])]);
    if(this.inventoryKey===key)return false;
    const originals=new Map<string,AtlasStyleDocument>();
    for(const preset of ATLAS_STYLE_PRESETS){
      const doc=createAtlasPresetDocument(preset.id,layers);
      doc.baseStyle=baseId;
      doc.metadata={...doc.metadata,
        authoredOnBaseStyle:baseId,
        originalPresetBaseStyle:preset.baseStyle,
        studioInstantPreview:true
      };
      originals.set(preset.id,doc);
    }
    this.baseId=baseId;
    this.layers=[...layers];
    this.inventoryKey=key;
    this.originals=originals;
    this.palettes.clear();
    return true;
  }

  /**
   * Return an independent document: layer editing must never mutate
   * a cached preset or another application's theme settings.
   */
  get(presetId:string,palette:readonly string[]|null=null):AtlasStyleDocument{
    if(!this.ready){
      const fresh=palette
        ?reskinAtlasPreset(presetId,palette,this.layers)
        :createAtlasPresetDocument(presetId,this.layers);
      fresh.baseStyle=this.baseId;
      return fresh;
    }
    if(!palette){
      const original=this.originals.get(presetId);
      if(!original)throw new Error("Unknown Atlas studio preset: "+presetId);
      return JSON.parse(JSON.stringify(original)) as AtlasStyleDocument;
    }
    const key=JSON.stringify([presetId,palette]);
    let generated=this.palettes.get(key);
    if(!generated){
      generated=reskinAtlasPreset(presetId,palette,this.layers);
      generated.baseStyle=this.baseId;
      generated.metadata={...generated.metadata,
        authoredOnBaseStyle:this.baseId,
        studioInstantPreview:true
      };
    }else this.palettes.delete(key);
    this.palettes.set(key,generated);
    if(this.palettes.size>this.paletteLimit){
      const oldest=this.palettes.keys().next().value;
      if(oldest!==undefined)this.palettes.delete(oldest);
    }
    return JSON.parse(JSON.stringify(generated)) as AtlasStyleDocument;
  }
}
