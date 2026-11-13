// Connection.exceptionCaught uses "Internal Exception: " plus the exception's
// own description. Keep real JavaScript error names; never invent Java frames.
export function networkExceptionReason(error){
  if(error?.name==='TimeoutError'||error?.code==='ETIMEDOUT')return 'Timed out';
  return 'Internal Exception: '+String(error instanceof Error?error:new Error(String(error)));
}
export class DecoderError extends Error {
  constructor(message,{cause,packet,byteOffset}={}){
    super(message,{cause});this.name='DecoderError';
    if(packet!==undefined)this.packet=packet;
    if(byteOffset!==undefined)this.byteOffset=byteOffset;
  }
}
