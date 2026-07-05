import type { McpServer } from "@modelcontextprotocol/server";

const JDL_GRAMMAR = `# JHipster Domain Language (JDL) — cheat sheet

## Application block

\`\`\`jdl
application {
  config {
    baseName myApp
    applicationType monolith        // monolith | gateway | microservice
    authenticationType jwt          // jwt | oauth2 | session
    databaseType sql                // sql | mongodb | cassandra | couchbase | neo4j | no
    prodDatabaseType postgresql     // postgresql | mysql | mariadb | mssql | oracle
    devDatabaseType h2Disk
    clientFramework angular         // angular | react | vue | no
    buildTool maven                 // maven | gradle
    packageName com.example.app
    serverPort 8080
  }
  entities *                        // include all entities below; or list them: User, Order
}
\`\`\`

## Entity

\`\`\`jdl
entity Customer {
  firstName String required minlength(2) maxlength(50)
  lastName  String required
  email     String required pattern(/^[^@]+@[^@]+$/)
  birthDate LocalDate
  loyalty   Integer min(0) max(100)
}
\`\`\`

### Field types
String, Integer, Long, BigDecimal, Float, Double, Boolean,
LocalDate, Instant, ZonedDateTime, Duration, UUID,
Blob, AnyBlob, ImageBlob, TextBlob, plus any enum you declare.

### Validations
required, unique, minlength(n), maxlength(n), min(n), max(n), pattern(/regex/)

## Enum

\`\`\`jdl
enum OrderStatus { PENDING, PAID, SHIPPED, CANCELLED }
\`\`\`

## Relationships

\`\`\`jdl
relationship OneToMany {
  Customer{orders} to Order{customer required}
}
relationship ManyToMany {
  Order{products} to Product{orders}
}
\`\`\`

Cardinalities: OneToOne, OneToMany, ManyToOne, ManyToMany.
Side syntax: \`Entity{fieldName required}\`. The back-reference field is optional on the target side.

## Options (apply to entities)

\`\`\`jdl
paginate * with pagination except Country
service * with serviceClass
dto * with mapstruct
search Order, Product with elasticsearch
readOnly Country
filter Order
\`\`\`

## Microservice example

\`\`\`jdl
application {
  config { baseName gateway, applicationType gateway, packageName com.acme.gateway }
  entities *
}
application {
  config { baseName orders, applicationType microservice, packageName com.acme.orders, serverPort 8081 }
  entities Order, OrderItem
}

entity Order { reference String required, total BigDecimal required min(0) }
entity OrderItem { qty Integer required min(1) }
relationship OneToMany { Order{items} to OrderItem{order required} }

paginate * with pagination
service * with serviceClass
dto * with mapstruct
\`\`\`
`;

export function registerJdlGrammar(server: McpServer): void {
  server.registerResource(
    "jdl-grammar",
    "jhipster://docs/jdl-grammar",
    {
      title: "JDL grammar cheat-sheet",
      description:
        "Concise reference for the JHipster Domain Language: application config, entities, fields, validations, enums, relationships, and options.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: JDL_GRAMMAR,
        },
      ],
    }),
  );
}
