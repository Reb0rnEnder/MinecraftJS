#define NULL ((void*)0)
// Small freestanding stb_truetype bridge. A font owns one Wasm instance; scratch
// allocations are reset for each glyph. No host fonts, filesystem, WASI or DOM.
typedef unsigned int size_t;
extern unsigned char __heap_base;
static unsigned int head, saved;
void *memcpy(void *d,const void *s,size_t n){for(size_t i=0;i<n;i++)((char*)d)[i]=((const char*)s)[i];return d;}
void *memset(void *d,int c,size_t n){for(size_t i=0;i<n;i++)((char*)d)[i]=c;return d;}
void *alloc(size_t n){if(!head)head=(unsigned int)&__heap_base;unsigned int p=head;head=(head+n+15)&~15u;unsigned int pages=__builtin_wasm_memory_size(0);if(head>pages*65536u&&__builtin_wasm_memory_grow(0,(head-pages*65536u+65535u)/65536u)==(size_t)-1)__builtin_trap();return (void*)p;}
__attribute__((import_module("math"),import_name("pow"))) double host_pow(double,double);
__attribute__((import_module("math"),import_name("cos"))) double host_cos(double);
__attribute__((import_module("math"),import_name("acos"))) double host_acos(double);
__attribute__((import_module("math"),import_name("fmod"))) double host_fmod(double,double);
#define STBTT_ifloor(x) ((int)__builtin_floor(x))
#define STBTT_iceil(x) ((int)__builtin_ceil(x))
#define STBTT_sqrt(x) __builtin_sqrt(x)
#define STBTT_pow(x,y) host_pow(x,y)
#define STBTT_cos(x) host_cos(x)
#define STBTT_acos(x) host_acos(x)
#define STBTT_fmod(x,y) host_fmod(x,y)
#define STBTT_fabs(x) __builtin_fabs(x)
#define STBTT_malloc(x,u) alloc(x)
#define STBTT_free(x,u) ((void)0)
#define STBTT_assert(x) do{if(!(x))__builtin_trap();}while(0)
#define STBTT_strlen(x) 0
#define STBTT_memcpy memcpy
#define STBTT_memset memset
#define STB_TRUETYPE_IMPLEMENTATION
#include "stb_truetype.h"
static stbtt_fontinfo font;
static float metrics[8];
int init(unsigned char *data){int offset=stbtt_GetFontOffsetForIndex(data,0);if(offset<0||!stbtt_InitFont(&font,data,offset))return 0;saved=head;return 1;}
float *info(void){return metrics;}
unsigned char *glyph(int code,float size,float over,float sx,float sy){
 head=saved;int g=stbtt_FindGlyphIndex(&font,code);if(!g)return 0;
 float scale=stbtt_ScaleForPixelHeight(&font,size*over),dx=sx*over,dy=sy*over;
 int x0,y0,x1,y1,adv,lsb,ascent,descent,gap;
 stbtt_GetGlyphBitmapBoxSubpixel(&font,g,scale,scale,dx,dy,&x0,&y0,&x1,&y1);
 int w=x1-x0,h=y1-y0;if(w<=0||h<=0||w>1024||h>1024)return 0;
 stbtt_GetGlyphHMetrics(&font,g,&adv,&lsb);stbtt_GetFontVMetrics(&font,&ascent,&descent,&gap);
 metrics[0]=w;metrics[1]=h;metrics[2]=(lsb*scale+x0+dx)/over;metrics[3]=(ascent*scale+y0+dy)/over-3;metrics[4]=adv*scale/over;
 unsigned char *pixels=alloc(w*h);stbtt_MakeGlyphBitmapSubpixel(&font,pixels,w,h,w,scale,scale,dx,dy,g);return pixels;
}
