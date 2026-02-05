export default function handler(req, res){
  res.status(200).json({ ok:true, endpoint:"rate2", version:"test-1" });
}
