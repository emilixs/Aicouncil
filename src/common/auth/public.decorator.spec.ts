import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('Public decorator', () => {
  it('should set isPublic metadata to true on the decorated target', () => {
    // Create a test class with the decorator applied to a method
    class TestController {
      @Public()
      testMethod() {}
    }

    // Retrieve the metadata set by the decorator
    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestController.prototype.testMethod);

    expect(metadata).toBe(true);
  });

  it('should export IS_PUBLIC_KEY as "isPublic"', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });
});
