import { Chess, type Square } from "chess.js";
import type { PatternId } from "./types";

/** Structural checks supplement the source theme tag and legal mating replay. */
export function matchesMateGeometry(chess: Chess, pattern: PatternId): boolean {
  if (!chess.isCheckmate()) return false;
  const defender=chess.turn(), attacker=defender==='w'?'b':'w';
  const pieces=chess.board().flat().filter(p=>p!==null);
  const king=pieces.find(p=>p.color===defender&&p.type==='k')!;
  const x=king.square.charCodeAt(0),y=Number(king.square[1]);
  const at=(dx:number,dy:number):Square|null=>x+dx>=97&&x+dx<=104&&y+dy>=1&&y+dy<=8?`${String.fromCharCode(x+dx)}${y+dy}` as Square:null;
  const own=(dx:number,dy:number)=>{const square=at(dx,dy);return Boolean(square&&chess.get(square)?.color===defender);};
  const neighbors=[-1,0,1].flatMap(dx=>[-1,0,1].flatMap(dy=>dx||dy?at(dx,dy)??[]:[]));
  const checkers=chess.attackers(king.square,attacker);
  const rooks=checkers.filter(square=>chess.get(square)?.type==='r');
  const queens=checkers.filter(square=>chess.get(square)?.type==='q');
  const knights=pieces.filter(p=>p.color===attacker&&p.type==='n');
  const knightFlights=knights.some(knight=>neighbors.some(square=>chess.attackers(square,attacker).includes(knight.square)));
  switch(pattern){
    case 'back-rank': return (y===1||y===8)&&checkers.some(square=>['r','q'].includes(chess.get(square)!.type)&&square[1]===king.square[1]);
    case 'smothered': return checkers.some(square=>chess.get(square)?.type==='n')&&neighbors.every(square=>chess.get(square)?.color===defender);
    case 'arabian': return [97,104].includes(x)&&[1,8].includes(y)&&rooks.some(rook=>chess.attackers(rook,attacker).some(square=>chess.get(square)?.type==='n'))&&knightFlights;
    case 'anastasia': return [97,104].includes(x)&&checkers.some(square=>['r','q'].includes(chess.get(square)!.type)&&square[0]===king.square[0])&&knightFlights;
    case 'boden': return checkers.some(square=>chess.get(square)?.type==='b')&&pieces.filter(p=>p.color===attacker&&p.type==='b').some(bishop=>!checkers.includes(bishop.square)&&neighbors.some(square=>chess.attackers(square,attacker).includes(bishop.square)));
    case 'dovetail': return queens.some(square=>{const dx=Math.sign(x-square.charCodeAt(0)),dy=Math.sign(y-Number(square[1]));return Math.abs(x-square.charCodeAt(0))===1&&Math.abs(y-Number(square[1]))===1&&own(dx,0)&&own(0,dy);});
    case 'swallows-tail': return queens.some(square=>{const dx=x-square.charCodeAt(0),dy=y-Number(square[1]);return Math.abs(dx)+Math.abs(dy)===1&&(dx?own(dx,1)&&own(dx,-1):own(1,dy)&&own(-1,dy));});
    case 'epaulette': return own(1,0)&&own(-1,0)||own(0,1)&&own(0,-1);
    case 'hook': return rooks.some(rook=>knights.some(knight=>chess.attackers(rook,attacker).includes(knight.square)&&chess.attackers(knight.square,attacker).some(square=>chess.get(square)?.type==='p')))&&knightFlights;
    case 'vukovic': return rooks.some(rook=>chess.attackers(rook,attacker).length>0)&&knightFlights;
  }
}
