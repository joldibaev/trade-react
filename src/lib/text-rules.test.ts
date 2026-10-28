import { describe, expect, it } from "vitest"

import { textRules } from "@/api/text-rules.gen"

import {
  maxLength,
  textError,
  textLength,
  textRule,
  textValidator,
} from "./text-rules"

const name = textRule("CreatePaymentMethodRequest", "name")
const multiline = textRule("ReceiptBlockText", "text")

describe("the rules the API publishes", () => {
  it("arrive for the fields people type into", () => {
    expect(textRules.CreatePaymentMethodRequest.name.maxLength).toBe(100)
    expect(textRules.CreateUserRequest.password.minLength).toBe(15)
    expect(textRules.ReceiptBlockText.text.maxLength).toBe(300)
    expect(textRules.CreateStoreRequest.phone.pattern.test("")).toBe(true)
    expect(textRules.CreateCounterpartyRequest.phone.pattern.test("")).toBe(
      false
    )
  })
})

describe("textError over a single-line name", () => {
  const accepted = [
    "Тетрадь 48 листов",
    "Click",
    "a",
    "Кетчуп «Махеев», 500 г",
    "x".repeat(100),
    // Two code points that are one letter once normalized: 100 of them are 100 characters.
    "Ä".repeat(100),
  ]
  const refused: [string, string, ReturnType<typeof textError>][] = [
    ["leading space", " Тетрадь", "INVALID_FORMAT"],
    ["trailing space", "Тетрадь ", "INVALID_FORMAT"],
    ["trailing line break", "Тетрадь\n", "INVALID_FORMAT"],
    ["line break inside", "Тет\nрадь", "INVALID_FORMAT"],
    ["NUL", "a\u0000b", "INVALID_FORMAT"],
    ["zero width space", "a​b", "INVALID_FORMAT"],
    ["right-to-left override", "a‮b", "INVALID_FORMAT"],
    ["101 characters", "x".repeat(101), "OUT_OF_RANGE"],
    // One code unit that grows to two under NFC: 51 of them are 102 characters.
    ["growth under NFC", "̈́".repeat(51), "OUT_OF_RANGE"],
    ["nothing", "", "REQUIRED"],
  ]

  it.each(accepted)("accepts %j", (text) => {
    expect(textError(text, name)).toBeUndefined()
  })

  it.each(refused)("refuses %s", (_, text, code) => {
    expect(textError(text, name)).toBe(code)
  })

  it("measures the NFC form", () => {
    expect(textLength("Ä")).toBe(1)
    expect(textLength("̈́")).toBe(2)
  })
})

describe("textError over a multiline text", () => {
  it("allows a line break inside, never at an end, never a carriage return", () => {
    expect(textError("Спасибо!\nДо встречи", multiline)).toBeUndefined()
    expect(textError("Спасибо!\n", multiline)).toBe("INVALID_FORMAT")
    expect(textError("\nСпасибо!", multiline)).toBe("INVALID_FORMAT")
    expect(textError("a\r\nb", multiline)).toBe("INVALID_FORMAT")
  })

  it("holds it to 300 characters", () => {
    expect(textError("x".repeat(300), multiline)).toBeUndefined()
    expect(textError("x".repeat(301), multiline)).toBe("OUT_OF_RANGE")
    expect(maxLength(multiline)).toBe(300)
  })
})

describe("empty text", () => {
  it("is refused where the field needs a value", () => {
    expect(textError("", textRule("CreateStoreRequest", "name"))).toBe(
      "REQUIRED"
    )
    expect(textError("", textRule("LoginRequest", "login"))).toBe("REQUIRED")
  })

  it("is accepted where the pattern takes it to remove a value", () => {
    const rules = [
      textRule("UpdateStoreRequest", "phone"),
      textRule("UpdateStoreRequest", "address"),
      textRule("UpdateCounterpartyRequest", "phone"),
      textRule("UpdateCounterpartyRequest", "taxId"),
      textRule("UpdateCounterpartyRequest", "note"),
      textRule("UpdateRevaluationRequest", "comment"),
    ]
    for (const rule of rules) expect(textError("", rule)).toBeUndefined()
  })

  it("is accepted for an optional field a form sends as null, refused when it is required", () => {
    const phone = textRule("CreateCounterpartyRequest", "phone")
    expect(textError("", phone, { required: false })).toBeUndefined()
    expect(textError("", phone)).toBe("REQUIRED")
  })
})

describe("phones, tax ids, logins and barcodes", () => {
  const phone = textRule("CreateUserRequest", "phone")
  it("take the formats the API publishes", () => {
    expect(textError("+998901234567", phone)).toBeUndefined()
    expect(textError("998901234567", phone)).toBe("INVALID_FORMAT")
    expect(textError("+998 90 1234567", phone)).toBe("INVALID_FORMAT")
    expect(textError("+0123456789", phone)).toBe("INVALID_FORMAT")
    const taxId = textRule("CreateCounterpartyRequest", "taxId")
    expect(textError("305123456", taxId)).toBeUndefined()
    expect(textError("30512345678901", taxId)).toBeUndefined()
    expect(textError("30512345", taxId)).toBe("INVALID_FORMAT")
    const login = textRule("CreateUserRequest", "login")
    expect(textError("admin.user_1-é", login)).toBeUndefined()
    expect(textError("a b", login)).toBe("INVALID_FORMAT")
    const barcode = textRule("BarcodeRequest", "value")
    expect(textError("4780000000014", barcode)).toBeUndefined()
    expect(textError("47800 00", barcode)).toBe("INVALID_FORMAT")
  })
})

describe("the password", () => {
  const password = textRule("CreateUserRequest", "password")
  it("needs 15 characters and has no other rule", () => {
    expect(textError("x".repeat(14), password)).toBe("PASSWORD_TOO_SHORT")
    expect(textError("x".repeat(15), password)).toBeUndefined()
    expect(textError(" пароль с пробелами ", password)).toBeUndefined()
    expect(textError("x".repeat(1025), password)).toBe("OUT_OF_RANGE")
    expect(textError("", password)).toBe("REQUIRED")
  })
})

describe("textValidator", () => {
  it("judges the text trimmed, the way forms send it", () => {
    const check = textValidator(name)
    expect(check({ value: "  Карта  " })).toBeUndefined()
    expect(check({ value: "   " })).toBe("REQUIRED")
  })

  it("never trims a password", () => {
    const check = textValidator(textRule("CreateUserRequest", "password"), {
      trim: false,
    })
    expect(
      check({ value: `${" ".repeat(5)}${"x".repeat(10)}` })
    ).toBeUndefined()
  })

  it("lets an optional field be empty", () => {
    const check = textValidator(textRule("CreateCounterpartyRequest", "note"), {
      required: false,
    })
    expect(check({ value: "" })).toBeUndefined()
    expect(check({ value: "строка\nвторая" })).toBeUndefined()
  })
})
