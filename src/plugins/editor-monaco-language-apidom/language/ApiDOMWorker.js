/* eslint-disable no-underscore-dangle */
import deepExtend from 'deep-extend';
import * as vscodeLanguageServerTextDocument from 'vscode-languageserver-textdocument';
import * as apidomLS from '@swagger-api/apidom-ls';

export class ApiDOMWorker {
  static defaultApiDOMContext = {
    validatorProviders: [],
    completionProviders: [],
    performanceLogs: false,
    logLevel: apidomLS.LogLevel.DEBUG,
    defaultLanguageContent: {
      namespace: 'handlebars',
      version: '1.0',
      format: 'TEXT',
      mediaType: 'application/vnd.aai.handlebars;version=1.0',
    },
    completionContext: {
      maxNumberOfItems: 100,
      enableLSPFilter: false, // enables "strict" word filtering (instead of default Monaco fuzzy matching; https://github.com/swagger-api/apidom/pull/2954)
    },
    validationContext: {
      referenceValidationMode: apidomLS.ReferenceValidationMode.APIDOM_INDIRECT_EXTERNAL,
    },
    // handlebarsJsonSchemaCompletion: true,
    // handlebarsJsonSchemaCompletionImplementation: 'type-explorer',
  };

  constructor(ctx, createData) {
    this._ctx = ctx;
    this._createData = createData;
    this._languageService = this.createLanguageService();
  }

  createLanguageService() {
    return apidomLS.getLanguageService(
      deepExtend({}, this.constructor.defaultApiDOMContext, this._createData.apiDOMContext)
    );
  }

  async doValidation(uri) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }
    return this._languageService.doValidation(document);
  }

  // eslint-disable-next-line class-methods-use-this
  async doProvideDocumentHighlights(uri, position, token) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }
    return this._languageService.provideDocumentHighlights(document, position, token);
  }

  async doComplete(uri, position) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }
    return this._languageService.doCompletion(document, position);
  }

  async doHover(uri, position) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }
    return this._languageService.doHover(document, position);
  }

  async doLinks(uri) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }
    return this._languageService.doLinks(document);
  }

  async findDocumentSymbols(uri) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }
    return this._languageService.doFindDocumentSymbols(document);
  }

  async provideDefinition(uri, position) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }
    return this._languageService.doProvideDefinition(document, {
      uri,
      position,
    });
  }

  async doCodeActions(uri, diagnostics) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }
    return this._languageService.doCodeActions(document, diagnostics);
  }

  async findSemanticTokens(uri) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }
    return this._languageService.computeSemanticTokens(document);
  }

  async getSemanticTokensLegend() {
    return this._languageService.getSemanticTokensLegend();
  }

  async doDeref(uri, dereferenceContext = {}) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }

    return this._languageService.doDeref(document, dereferenceContext);
  }

  async getJsonPointerPosition(uri, jsonPointer) {
    const document = this._getTextDocument(uri);
    if (!document) {
      return [];
    }

    return this._languageService.getJsonPointerPosition(document, jsonPointer);
  }

  async refreshContext(uri, context) {
    return this._languageService.refreshContext(uri, context);
  }

  async getContext(processed = false) {
    return this._languageService.getContext(processed);
  }

  async renderTemplate(template) {
    return this._languageService.renderTemplateThroughService(template);
  }

  _getTextDocument(uri) {
    const model = this._ctx.getMirrorModels().find((mm) => mm.uri.toString() === uri);

    if (!model) return null;

    return vscodeLanguageServerTextDocument.TextDocument.create(
      uri,
      this._createData.languageId,
      model.version,
      model.getValue()
    );
  }
}

export const makeCreate = (BaseClass) => (ctx, createData) => {
  let ApiDOMWorkerClass = BaseClass;

  if (createData.customWorkerPath) {
    if (typeof globalThis.importScripts === 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(
        'Monaco is not using webworkers for background tasks, and that is needed to support the customWorkerPath flag'
      );
    } else {
      if (Array.isArray(createData.customWorkerPath)) {
        globalThis.importScripts(...createData.customWorkerPath);
      } else {
        globalThis.importScripts(createData.customWorkerPath);
      }

      const { customApiDOMWorkerFactory: workerFactoryFunc } = globalThis;
      if (typeof workerFactoryFunc !== 'function') {
        throw new Error(
          `The script at ${createData.customWorkerPath} does not add customApiDOMWorkerFactory to globalThis`
        );
      }

      ApiDOMWorkerClass = workerFactoryFunc(ApiDOMWorkerClass, {
        apidomLS,
        vscodeLanguageServerTextDocument,
        deepExtend,
      });
    }
  }

  return new ApiDOMWorkerClass(ctx, createData);
};
