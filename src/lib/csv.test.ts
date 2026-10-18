import { describe, expect, it } from "vitest";
import { extractLookup, parseCsv } from "./csv";

const SAMPLE = `id,bib,name,category,gender,tshirtSize,paymentStatus
11111111-1111-1111-1111-111111111111,1017,Budi Santoso,10K,M,L,settlement
22222222-2222-2222-2222-222222222222,1018,"Aminah, Siti",10K,F,S,pending
`;

describe("parseCsv", () => {
  it("parses rows with quoted commas and builds id/bib indexes", () => {
    const { data, errors } = parseCsv(SAMPLE);
    expect(errors).toEqual([]);
    expect(data!.list).toHaveLength(2);
    expect(data!.list[1].name).toBe("Aminah, Siti");
    expect(data!.byBib.get("1018")!.name).toBe("Aminah, Siti");
    expect(data!.byId.get("11111111-1111-1111-1111-111111111111")!.bib).toBe("1017");
  });

  it("normalizes id to lowercase", () => {
    const { data } = parseCsv("id,bib,name,category,paymentStatus\nAAAAAAAA-1111-1111-1111-111111111111,1,A,10K,settlement");
    expect(data!.byId.get("aaaaaaaa-1111-1111-1111-111111111111")).toBeDefined();
  });

  it("reports missing required columns", () => {
    const { data, errors } = parseCsv("bib,name\n1,A");
    expect(data).toBeNull();
    expect(errors[0]).toContain("id");
    expect(errors[0]).toContain("category");
  });
});

describe("extractLookup", () => {
  it("extracts uuid from /verify/ URL", () => {
    expect(extractLookup("https://lumpat.co.id/verify/22222222-2222-2222-2222-222222222222")).toEqual({
      id: "22222222-2222-2222-2222-222222222222",
      cleanedCode: "22222222-2222-2222-2222-222222222222",
    });
  });

  it("accepts raw uuid case-insensitively", () => {
    expect(extractLookup("AAAAAAAA-2222-2222-2222-222222222222")).toEqual({
      id: "aaaaaaaa-2222-2222-2222-222222222222",
      cleanedCode: "aaaaaaaa-2222-2222-2222-222222222222",
    });
  });

  it("extracts EPC from UHF reader JSON array payload", () => {
    const raw = `[{"i":"SENSOR_01","e":"E280116060000204A8B9C101","t":"23:51:06.028","eventId":"EVENT_01","rssi":"-70"}]`;
    expect(extractLookup(raw)).toEqual({
      epc: "E280116060000204A8B9C101",
      cleanedCode: "E280116060000204A8B9C101",
    });
  });

  it("extracts EPC from UHF reader JSON object payload", () => {
    const raw = `{"i":"SENSOR_01","e":"E280116060000204A8B9C101"}`;
    expect(extractLookup(raw)).toEqual({
      epc: "E280116060000204A8B9C101",
      cleanedCode: "E280116060000204A8B9C101",
    });
  });

  it("recognizes raw hex EPC", () => {
    expect(extractLookup("E280116060000204A8B9C101")).toEqual({
      epc: "E280116060000204A8B9C101",
      cleanedCode: "E280116060000204A8B9C101",
    });
  });

  it("treats numeric or plain string as bib", () => {
    expect(extractLookup(" 1017 ")).toEqual({
      bib: "1017",
      cleanedCode: "1017",
    });
  });
});
