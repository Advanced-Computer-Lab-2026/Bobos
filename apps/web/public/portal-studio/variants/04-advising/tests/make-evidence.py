#!/usr/bin/env python3
"""Compose documentary contact sheets from the browser test PNGs. Requires Pillow; no art is generated."""
import argparse,json,shutil
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

def font(size):
 for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf']:
  if Path(p).exists():return ImageFont.truetype(p,size)
 return ImageFont.load_default()
def run(a):
 root=Path(__file__).resolve().parent.parent;manifest=json.loads((root/'manifest.json').read_text());out=Path(a.target);out.mkdir(parents=True,exist_ok=True);(out/'contacts').mkdir(exist_ok=True);(out/'studio').mkdir(exist_ok=True);(out/'react').mkdir(exist_ok=True);(out/'motion').mkdir(exist_ok=True)
 studio=Path(a.studio);react=Path(a.react);motion=Path(a.motion)
 for item in manifest['pages']:
  key=item['key'];is_react=item['integration']=='React route adapter';prefix='slot' if key=='slot-changes-staff' else 'account'
  canvas=Image.new('RGB',(960,1840),'#f4f2eb');draw=ImageDraw.Draw(canvas);draw.text((20,15),key,font=font(21),fill='#282723');draw.text((20,44),'Ten choices in the existing Portal · Coordinator · 1440 × 1000 source captures',font=font(12),fill='#55534c')
  for i,v in enumerate(item['variants']):
   source=react/f'{prefix}-detail-{i+1}-light-1440.png' if is_react else studio/f'{key}-{i+1}-light-1440.png'
   im=Image.open(source).convert('RGB');im.thumbnail((450,313),Image.Resampling.LANCZOS);x=20+(i%2)*470;y=84+(i//2)*350;draw.text((x,y),f'{i+1:02}  {v["name"]}',font=font(14),fill='#282723');canvas.paste(im,(x,y+27))
  canvas.save(out/'contacts'/f'{key}-ten-choices.jpg',quality=92,subsampling=0)
  if not is_react:
   for mode in ['light','dark']:
    for width in [1440,390]:
     source=studio/f'{key}-3-{mode}-{width}.png';shutil.copy2(source,out/'studio'/source.name)
  else:
   for mode in ['light','dark']:
    for width in [1440,390]:
     source=react/f'{prefix}-detail-3-{mode}-{width}.png';shutil.copy2(source,out/'react'/source.name)
 for name in ['overview-light.png','overview-dark.png','draft-schedule-1-light-1440.png','draft-schedule-6-light-1440.png','draft-schedule-10-light-1440.png','draft-ready.png','draft-processed.png']:
  source=studio/name
  if source.exists():shutil.copy2(source,out/'studio'/name)
 for mode in ['light','dark']:
  canvas=Image.new('RGB',(1476,558),'#f4f2eb');d=ImageDraw.Draw(canvas)
  for j,(name,label) in enumerate([(f'overview-{mode}.png','Approved Overview · unchanged'),(f'directory-3-{mode}-1440.png','Directory · Student review desk')]):
   im=Image.open(studio/name).convert('RGB').resize((720,500),Image.Resampling.LANCZOS);x=12+732*j;d.text((x,14),label+' · '+mode,font=font(16),fill='#282723');canvas.paste(im,(x,47))
  canvas.save(out/f'overview-continuity-{mode}.jpg',quality=93,subsampling=0)
 captures=json.loads((motion/'motion-captures.json').read_text());canvas=Image.new('RGB',(1040,452),'#f4f2eb');d=ImageDraw.Draw(canvas);d.text((18,12),'Drawn motion · actual exposed poses, then quiet rest',font=font(19),fill='#282723')
 for j,kind in enumerate(['folder','letter']):
  d.text((18,52+195*j),kind.title()+' · Next record trigger',font=font(14),fill='#55534c')
  for i in range(6):
   im=Image.open(motion/f'{kind}-{i}.png').convert('RGB').resize((118,118),Image.Resampling.LANCZOS);x=20+i*170;y=80+j*195;canvas.paste(im,(x,y));r=next(r for r in captures if r['kind']==kind and r['frame']==i);d.text((x,y+123),f'{r["observedMilliseconds"]} ms · pose {r["observedPose"]}',font=font(12),fill='#282723')
  shutil.copy2(motion/f'{kind}-rest-in-context.png',out/'motion'/f'{kind}-rest-in-context.png')
 canvas.save(out/'motion'/'exposed-poses-contact.png');shutil.copy2(motion/'motion-captures.json',out/'motion'/'motion-captures.json')
 print('Created eight contact sheets, two Overview comparisons, representative desktop/mobile/theme captures and motion evidence.')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--studio',required=True);p.add_argument('--react',required=True);p.add_argument('--motion',required=True);p.add_argument('--target',required=True);run(p.parse_args())
