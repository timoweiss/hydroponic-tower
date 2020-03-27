// @ts-ignore
import { GoogleSpreadsheet } from 'google-spreadsheet';

export async function createSheetwriter({ sheetId }: { sheetId: string }) {
  const doc = new GoogleSpreadsheet(sheetId);
  // use service account creds

  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
  });
  await doc.loadInfo(); // loads document properties and worksheets
  console.log(doc.title);
  // await doc.updateProperties({ title: 'renamed doc' });

  const statsSheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id]
  const pumpSheet = doc.sheetsByIndex[1]; // or use doc.sheetsById[id]

  const stats = await statsSheet.getRows();
  const pumpRows = await pumpSheet.getRows();
  console.log({ stats, pumpRows });

  
  
  return {
    async addPumpEvent(obj: { date: Date; event: 'start' | 'stop' | string, reason: string }) {
      
      await pumpSheet.addRow(obj);
    },
    async addStats(obj: { date: Date; waterReservoirLevel: number, trickleBucket: number, pumpIsRunning: boolean }) {
      
      await statsSheet.addRow(obj);
    }
  }
}
