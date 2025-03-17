<html><head></head><body style="overflow-wrap: break-word; -webkit-nbsp-mode: space; line-break: after-white-space;"><span style="caret-color: rgb(0, 0, 0); color: rgb(0, 0, 0); font-family: system-ui, -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, Helvetica, Arial, sans-serif, &quot;Apple Color Emoji&quot;, &quot;Segoe UI Emoji&quot;, &quot;Segoe UI Symbol&quot;; font-size: medium; white-space: pre; -webkit-tap-highlight-color: rgba(0, 0, 0, 0); -webkit-text-size-adjust: 100%;">// stackbit.config.ts
import { defineStackbitConfig, SiteMapEntry } from "@stackbit/types";

export default defineStackbitConfig({
  // ...
  contentSources: [
    new GitContentSource({
      rootPath: __dirname,
      contentDirs: ["content"],
      models: [
        {
          name: "Page",
          type: "page",
          // Static URL path derived from the "slug" field
          urlPath: "/{slug}",
          filePath: "content/pages/{slug}.json",
          fields: [{ name: "title", type: "string", required: true }]
        },
        // ...
      ],
    })
  ],
  siteMap: ({ documents, models }) =&gt; {
    // 1. Filter all page models
    const pageModels = models.filter((m) =&gt; m.type === "page")

    return documents
      // 2. Filter all documents which are of a page model
      .filter((d) =&gt; pageModels.some(m =&gt; m.name === d.modelName))
      // 3. Map each document to a SiteMapEntry
      .map((document) =&gt; {
        // Map the model name to its corresponding URL
        const urlModel = (() =&gt; {
            switch (document.modelName) {
                case 'Page':
                    return 'otherPage';
                case 'Blog':
                    return 'otherBlog';
                default:
                    return null;
            }
        })();

        return {
          stableId: document.id,
          urlPath: `/${urlModel}/${document.id}`,
          document,
          isHomePage: false,
        };
      })
      .filter(Boolean) as SiteMapEntry[];
  }
});</span></body></html>