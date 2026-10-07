export function quickProofError(files:ReadonlyArray<{size:number;type:string}>):string|null{
 if(files.length<1||files.length>3)return '증빙 이미지를 1~3장 선택해 주세요.';
 if(files.some(file=>file.size===0))return '내용이 없는 파일은 첨부할 수 없습니다. 다른 이미지를 선택해 주세요.';
 if(files.some(file=>file.size>700000))return '각 이미지의 크기는 700KB 이하여야 합니다. 작은 이미지로 다시 선택해 주세요.';
 if(files.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)))return 'JPG, PNG, WEBP 형식의 이미지만 첨부해 주세요.';
 return null;
}
