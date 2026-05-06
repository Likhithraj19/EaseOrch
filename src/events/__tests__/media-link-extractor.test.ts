import { extractMediaLinks } from "../media-link-extractor";

describe("extractMediaLinks", () => {
  test("extracts markdown image links", () => {
    expect(extractMediaLinks("Screenshot: ![login](https://github.com/user-attachments/assets/login.png)")).toEqual([
      "https://github.com/user-attachments/assets/login.png"
    ]);
  });

  test("extracts GitHub-hosted video and file links", () => {
    expect(
      extractMediaLinks(
        "Demo https://github.com/user-attachments/assets/demo.mp4 and file https://github.com/acme/easeorch/files/123/log.txt"
      )
    ).toEqual([
      "https://github.com/user-attachments/assets/demo.mp4",
      "https://github.com/acme/easeorch/files/123/log.txt"
    ]);
  });

  test("returns an empty array when no media links exist", () => {
    expect(extractMediaLinks("No evidence attached yet")).toEqual([]);
  });
});
