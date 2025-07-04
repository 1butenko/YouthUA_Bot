import { bot } from '../index';

export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    await bot.processUpdate(req.body);
    res.status(200).send('OK');
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
