import fs from "fs";
import Irys from "@irys/sdk";

const HOSTNAME = "https://gateway.irys.xyz";
export class IrysService {
  private irys;

  constructor(irysUrl: string, token: string, endpoint: string, privateKey: string) {
    this.irys = new Irys({
      url: irysUrl, // URL of the node you want to connect to
      token, // Token used for payment
      key: privateKey, // Private key
      config: {providerUrl: endpoint}, // Optional provider URL, only required when using Devnet
    });
  }

  public async uploadImage(filePath: string): Promise<string | undefined> {
    console.log("uploadImage filePath", filePath);

    // Get size of file
    const {size} = await fs.promises.stat(filePath);
    // Get cost to upload "size" bytes
    const price = await this.irys.getPrice(size);
    console.log(`Uploading ${size} bytes costs ${this.irys.utils.fromAtomic(price)}`);
    // Fund the node
    await this.irys.fund(price);

    // Upload metadata
    try {
      const response = await this.irys.uploadFile(filePath);
      const imageUri = `${HOSTNAME}/${response.id}`;
      console.log(`File uploaded ==> ${imageUri}`);
      return imageUri;
    } catch (e) {
      console.log("Error uploading file ", e);
    }

    return;
  }

  public async uploadAssets(params: {
    name: string;
    symbol: string;
    description: string;
    image: string;
  }): Promise<string | undefined> {
    console.log("uploadAssets params", params);

    try {
      const receipt = await this.irys.upload(JSON.stringify(params));
      const assetsUri = `${HOSTNAME}/${receipt.id}`;
      console.log(`Data uploaded ==> ${assetsUri}`);
      return assetsUri;
    } catch (e) {
      console.log("Error uploading data ", e);
    }
    return;
  }
}
