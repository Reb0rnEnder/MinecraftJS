# Resource image namespace correction

Standalone images now use the pack-aware ResourceLocation reader for qualified names, instead of looking up a literal colon under the minecraft textures directory. This preserves existing unqualified paths and prevents custom entity/pattern images from disappearing. Resource namespaces are native to this target; no later registries or banner schemas are introduced.

The actual image-loading and cache path, resource model priorities and native banner compositor have six passing regressions on 1.13.2.
