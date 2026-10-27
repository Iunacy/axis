import { ImageResponse } from "next/og";
import { AXIS_MARK_PATH } from "./brand";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = "AXIS — Every move leaves a pattern.";

export function renderOgImage() {
  return new ImageResponse(
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between",background:"#111314",color:"#e7e9e3",padding:"52px 64px",position:"relative"}}>
      <div style={{display:"flex",gap:16,alignItems:"center"}}>
        <svg width="38" height="38" viewBox="0 0 32 32" fill="#c7de8a"><path d={AXIS_MARK_PATH}/></svg>
        <span style={{fontSize:30,fontWeight:600,letterSpacing:-1}}>AXIS</span>
        <span style={{marginLeft:"auto",fontSize:20,color:"#a0a8a7"}}>Chess intelligence & personal practice</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:24,position:"relative"}}>
        <div style={{fontSize:88,lineHeight:1.02,letterSpacing:-3,fontWeight:500,maxWidth:850}}>Every move leaves a pattern.</div>
        <div style={{fontSize:25,color:"#a0a8a7"}}>Understand your decisions. Train what matters.</div>
      </div>
      <div style={{display:"flex",borderTop:"1px solid #303637",paddingTop:24,justifyContent:"space-between",fontSize:19}}>
        <span style={{color:"#a0a8a7"}}>Chess.com · Lichess · PGN · Stockfish</span>
        <span style={{color:"#c7de8a"}}>Free. Private. No account.</span>
      </div>
    </div>,
    ogSize
  );
}
